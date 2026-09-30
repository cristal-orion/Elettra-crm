#!/usr/bin/env python3
"""Operazioni host per un'app Coolify: segreti root-only, backup e restore isolato.

Non richiede token Coolify persistenti: le operazioni di configurazione usano
un token locale temporaneo, eliminato al termine e con scadenza di 10 minuti.
"""
import argparse
import contextlib
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

CONFIG = Path("/etc/elettra-crm/runtime.json")
STATE = Path("/var/lib/elettra-crm")
INSTALL = Path("/opt/elettra-crm-ops")


class OpsError(Exception):
    pass


def event(name, **values):
    print(json.dumps({"event": name, **values}), flush=True)


def run(args, *, env=None, input=None, timeout=360):
    result = subprocess.run(args, input=input, env=env, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if result.returncode:
        raise OpsError(f"Comando operativo fallito (exit {result.returncode}); controllare stato container e configurazione.")
    return result.stdout.strip()


def docker(*args, **kwargs):
    return run(["docker", *args], **kwargs)


def inspect(container):
    return json.loads(docker("inspect", container))[0]


def private_json(path, data):
    path = Path(path)
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix=".state-")
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w") as output:
            json.dump(data, output)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def load():
    if CONFIG.stat().st_mode & 0o077 or CONFIG.stat().st_uid != 0:
        raise OpsError("Configurazione operativa deve appartenere a root con permessi 0600.")
    return json.loads(CONFIG.read_text())


def save(config):
    private_json(CONFIG, config)


def container_env(container):
    return dict(value.split("=", 1) for value in inspect(container)["Config"]["Env"] if "=" in value)


def php(code):
    return docker("exec", "coolify", "php", "artisan", "tinker", "--execute=" + code)


@contextlib.contextmanager
def api_token():
    name = "elettra-ops-" + secrets.token_hex(8)
    try:
        token = json.loads(php(f'session(["currentTeam"=>App\\Models\\Team::findOrFail(0)]); $t=App\\Models\\User::findOrFail(0)->createToken("{name}", ["read","write","deploy"], now()->addMinutes(10)); echo json_encode(["id"=>$t->accessToken->id,"token"=>$t->plainTextToken]);'))
    except ValueError:
        php(f'Laravel\\Sanctum\\PersonalAccessToken::where("name", "{name}")->delete();')
        raise OpsError("Token operativo temporaneo non creato.") from None
    try:
        yield token["token"]
    finally:
        php(f'Laravel\\Sanctum\\PersonalAccessToken::where("id", {int(token["id"])})->delete();')


def api(token, method, path, data=None):
    request = urllib.request.Request("http://127.0.0.1:8888/api/v1/" + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json", "Accept": "application/json"}, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise OpsError(f"API Coolify: HTTP {error.code} per {method} {path}.") from None


def active(config):
    return docker("ps", "--filter", f'label=coolify.applicationId={config["app_id"]}', "--format", "{{.ID}}").splitlines()


def no_deployment(config):
    count = php(f'echo App\\Models\\ApplicationDeploymentQueue::where("application_id", {int(config["app_id"])})->whereIn("status", ["queued", "in_progress"])->count();')
    if int(count):
        raise OpsError("Deploy in corso o in coda: backup/cambio rimandato.")


@contextlib.contextmanager
def maintenance_lock():
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (STATE / "maintenance.lock").open("a") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise OpsError("Un'altra operazione Elettra è in corso.") from None
        yield


@contextlib.contextmanager
def stopped_app(config):
    no_deployment(config)
    containers = active(config)
    if not containers:
        raise OpsError("App già ferma: backup non avviato.")
    try:
        for container in containers:
            docker("stop", "--time", "180", container)
        yield
    finally:
        for container in containers:
            docker("start", container)


def psql(config, sql, *, database=None, user=None):
    return docker("exec", "-i", config["db_uuid"], "psql", "-U", user or config["db_admin_user"],
        "-d", database or config["db_name"], "-v", "ON_ERROR_STOP=1", "-At", input=sql)


def row_counts(config, database=None):
    # Solo conteggi; nessun dato aziendale o credenziale nei manifest/log.
    tables = psql(config, "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;", database=database).splitlines()
    return {table: int(psql(config, 'SELECT count(*) FROM "' + table.replace('"', '""') + '";', database=database)) for table in tables}


def docker_environment(values):
    return {**os.environ, **values}


def uploads_manifest(root):
    records = {}
    for entry in sorted(Path(root).rglob("*")):
        if entry.is_symlink():
            raise OpsError("Symlink nell'archivio allegati: verifica manuale richiesta.")
        if entry.is_file():
            with entry.open("rb") as source:
                records[str(entry.relative_to(root))] = hashlib.file_digest(source, "sha256").hexdigest()
    return records


def wait_ready(config, seconds=120):
    # Il processo riparte prima che Docker/Traefik lo considerino healthy.
    deadline = time.monotonic() + seconds
    while True:
        try:
            with urllib.request.urlopen(config["app_origin"] + "/api/health/ready", timeout=10) as response:
                if json.load(response).get("status") == "ready":
                    return
        except (OSError, ValueError):
            pass
        if time.monotonic() >= deadline:
            raise OpsError("App riavviata ma readiness non raggiunta entro il tempo previsto.")
        time.sleep(3)


def maintenance_active():
    with (STATE / "maintenance.lock").open("a") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_SH | fcntl.LOCK_NB)
        except BlockingIOError:
            return True
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)
    return False


def prepare(args):
    if CONFIG.exists():
        raise OpsError("Configurazione già presente: non sovrascrivo credenziali o rollback.")
    for value in [args.app, args.database]:
        if not re.fullmatch(r"[a-z0-9]{12,64}", value):
            raise OpsError("UUID risorsa non valido.")
    with api_token() as token:
        app = api(token, "GET", f"applications/{args.app}")
        db = api(token, "GET", f"databases/{args.database}")
    if app.get("environment_id") != args.environment or db.get("environment_id") != args.environment or db.get("is_public"):
        raise OpsError("Ambiente delle risorse o accesso privato DB non verificati.")
    cfg = {"app_uuid": args.app, "app_id": args.app_id, "db_uuid": args.database,
        "db_name": db["postgres_db"], "db_admin_user": db["postgres_user"], "app_origin": app["fqdn"],
        "stage": "prepared", "maintenance": False, "local_only_accepted": True,
        "ops_dir": str(INSTALL), "backups": str(STATE / "backups")}
    containers = active(cfg)
    if len(containers) != 1:
        raise OpsError("Attesa una sola istanza web.")
    source = inspect(containers[0])
    mounts = [m for m in source["Mounts"] if m["Destination"] == "/data" and m["Type"] == "volume"]
    if len(mounts) != 1:
        raise OpsError("Volume /data non verificato.")
    source_env = container_env(containers[0])
    session = source_env.get("SESSION_SECRET", "")
    if len(session.encode()) < 32:
        raise OpsError("Segreto sessioni legacy non valido.")
    cfg.update({"source_container": source["Name"].lstrip("/"), "source_inspect": source,
        "volume": mounts[0]["Name"], "session_secret": session, "data_secret": secrets.token_urlsafe(48),
        "app_password": secrets.token_urlsafe(36)})
    admin_password = container_env(args.database).get("POSTGRES_PASSWORD")
    if not admin_password:
        raise OpsError("Credenziale amministrativa PostgreSQL non disponibile.")
    prefix = "postgresql://elettra:" + urllib.parse.quote(cfg["app_password"], safe="") + "@" + args.database + ":5432/"
    cfg["database_url"] = prefix + cfg["db_name"] + "?schema=public&connection_limit=10&connect_timeout=5&pool_timeout=5"
    cfg["backup_database_url"] = prefix + cfg["db_name"]
    cfg["admin_database_url"] = "postgresql://" + urllib.parse.quote(cfg["db_admin_user"], safe="") + ":" + urllib.parse.quote(admin_password, safe="") + "@" + args.database + ":5432/" + cfg["db_name"]
    if psql(cfg, "SELECT count(*) FROM pg_roles WHERE rolname='elettra';") != "0":
        raise OpsError("Ruolo elettra già presente: non cambio password esistenti.")
    psql(cfg, f"CREATE ROLE elettra LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '{cfg['app_password']}';\nALTER DATABASE \"{cfg['db_name']}\" OWNER TO elettra;\nALTER SCHEMA public OWNER TO elettra;\nREVOKE ALL ON DATABASE \"{cfg['db_name']}\" FROM PUBLIC;\nREVOKE ALL ON SCHEMA public FROM PUBLIC;")
    flags = psql(cfg, "SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication FROM pg_roles WHERE rolname='elettra';")
    if flags != "f|f|f|f":
        raise OpsError("Ruolo applicativo non ristretto.")
    cfg["rollback_image"] = "elettra-crm:rollback-sqlite-" + dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d")
    docker("tag", source["Image"], cfg["rollback_image"])
    INSTALL.mkdir(mode=0o700, parents=True, exist_ok=True)
    for file in Path(__file__).parent.iterdir():
        if file.suffix in (".py", ".sh"):
            shutil.copy2(file, INSTALL / file.name)
            os.chmod(INSTALL / file.name, 0o700)
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    save(cfg)
    event("postgres_prepared", database=args.database, private=True, superuser=False)


def cutover(args):
    cfg = load()
    if cfg["stage"] != "prepared":
        raise OpsError("Cambio già avviato: non ripeto migrazione o backup legacy.")
    with maintenance_lock():
        no_deployment(cfg)
        cfg["maintenance"] = True
        save(cfg)
        docker("stop", "--time", "180", cfg["source_container"])
        try:
            stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            bundle = STATE / "legacy" / stamp
            bundle.mkdir(mode=0o700, parents=True)
            docker("run", "--rm", "--mount", f'type=volume,src={cfg["volume"]},dst=/source,readonly',
                "--mount", f"type=bind,src={bundle},dst=/out", "postgres:16-alpine", "sh", "-c",
                "umask 077; tar -czf /out/sqlite-volume.tar.gz -C /source . && tar -tzf /out/sqlite-volume.tar.gz >/dev/null && cd /out && sha256sum sqlite-volume.tar.gz > SHA256SUMS")
            source_root = inspect(cfg["source_container"])["Mounts"]
            root = next(m["Source"] for m in source_root if m["Destination"] == "/data")
            cfg["legacy_uploads"] = uploads_manifest(Path(root) / "uploads")
            cfg["legacy_bundle"] = str(bundle)
            save(cfg)
            env = docker_environment({"DATABASE_URL": cfg["database_url"]})
            docker("run", "--rm", "--network", "coolify", "-e", "DATABASE_URL", "--entrypoint", "node_modules/.bin/prisma", args.image, "migrate", "deploy", env=env)
            report = docker("run", "--rm", "--network", "coolify", "-e", "DATABASE_URL",
                "--mount", f'type=volume,src={cfg["volume"]},dst=/legacy,readonly', "--entrypoint", "node_modules/.bin/tsx", args.image,
                "scripts/migrate-sqlite.ts", "/legacy/elettra.db", "--execute", env=env)
            if "Migrazione e confronto integrale riusciti." not in report:
                raise OpsError("Migrazione senza conferma di confronto integrale.")
            (bundle / "migration-report.txt").write_text(report)
            os.chmod(bundle / "migration-report.txt", 0o600)
            docker("run", "--rm", "--mount", f'type=volume,src={cfg["volume"]},dst=/data', "postgres:16-alpine", "sh", "-c", "chown -R 1000:1000 /data/uploads")
            with api_token() as token:
                values = {"DATABASE_URL": cfg["database_url"], "SESSION_SECRET": cfg["session_secret"],
                    "DATA_ENCRYPTION_SECRET": cfg["data_secret"], "APP_ORIGIN": cfg["app_origin"], "UPLOADS_DIR": "/data/uploads",
                    "SEED_ON_FIRST_BOOT": "false", "RUN_MIGRATIONS": "true"}
                api(token, "PATCH", f'applications/{cfg["app_uuid"]}/envs/bulk', {"data": [
                    {"key": key, "value": value, "is_preview": False, "is_buildtime": False, "is_runtime": True} for key, value in values.items()]})
            cfg["stage"] = "migrated"
            cfg["migration_counts"] = row_counts(cfg)
            save(cfg)
            event("cutover_migrated", rows=cfg["migration_counts"], upload_files=len(cfg["legacy_uploads"]), source_stopped=True)
        except Exception:
            docker("start", cfg["source_container"])
            cfg["maintenance"] = False
            cfg["stage"] = "migration_failed"
            save(cfg)
            raise


def backup(args):
    cfg = load()
    if cfg["stage"] != "live" or cfg["maintenance"]:
        raise OpsError("App non in stato operativo: backup rimandato.")
    with maintenance_lock():
        backups = Path(cfg["backups"])
        backups.mkdir(mode=0o700, parents=True, exist_ok=True)
        with stopped_app(cfg):
            counts = row_counts(cfg)
            # Percorso volume uploads rilevato da Docker, non concatenato a input esterno.
            uploads_root = docker("volume", "inspect", cfg["volume"], "--format", "{{.Mountpoint}}")
            manifest = uploads_manifest(Path(uploads_root) / "uploads")
            before = set(backups.iterdir())
            docker("run", "--rm", "--network", "coolify", "-e", "BACKUP_DATABASE_URL",
                "--mount", f'type=volume,src={cfg["volume"]},dst=/data,readonly',
                "--mount", f'type=bind,src={cfg["ops_dir"]},dst=/ops,readonly',
                "--mount", f"type=bind,src={backups},dst=/backups", "postgres:16-alpine", "sh", "/ops/backup-container.sh",
                env=docker_environment({"BACKUP_DATABASE_URL": cfg["backup_database_url"]}))
            created = [entry for entry in set(backups.iterdir()) - before if entry.is_dir() and not entry.name.startswith(".")]
            if len(created) != 1:
                raise OpsError("Bundle di backup non identificato.")
            bundle = created[0]
            private_json(bundle / "manifest.json", {"rows": counts, "uploads": manifest, "created": time.time()})
        wait_ready(cfg)
        state = {"bundle": str(bundle), "created": time.time(), "local_only": True}
        private_json(STATE / "last-backup.json", state)
        complete = sorted([p for p in backups.iterdir() if re.fullmatch(r"\d{8}T\d{6}Z", p.name) and (p / "manifest.json").exists()], reverse=True)
        for old in complete[14:]:
            shutil.rmtree(old)
        event("backup_complete", bundle=bundle.name, local_only=True, rows=sum(counts.values()), uploads=len(manifest))


def restore_check(args):
    cfg = load()
    last = json.loads((STATE / "last-backup.json").read_text())
    bundle = Path(last["bundle"])
    expected = json.loads((bundle / "manifest.json").read_text())
    database = "elettra_verify_" + secrets.token_hex(8)
    prefix = cfg["backup_database_url"].rsplit("/", 1)[0]
    with maintenance_lock(), tempfile.TemporaryDirectory(prefix="restore-", dir=STATE) as temp:
        psql(cfg, f'CREATE DATABASE "{database}" OWNER elettra;')
        try:
            docker("run", "--rm", "--network", "coolify", "-e", "RESTORE_DATABASE_URL",
                "--mount", f'type=bind,src={cfg["ops_dir"]},dst=/ops,readonly', "--mount", f"type=bind,src={bundle},dst=/bundle,readonly",
                "--mount", f"type=bind,src={temp},dst=/restore-data", "postgres:16-alpine", "sh", "/ops/restore-container.sh", "/bundle",
                env=docker_environment({"RESTORE_DATABASE_URL": prefix + "/" + database}))
            if row_counts(cfg, database=database) != expected["rows"]:
                raise OpsError("Conteggi del restore diversi dal backup.")
            if uploads_manifest(Path(temp) / "uploads") != expected["uploads"]:
                raise OpsError("Checksum allegati del restore diversi dal backup.")
            private_json(STATE / "last-restore.json", {"checked": time.time(), "bundle": str(bundle), "success": True})
            event("restore_verified", bundle=bundle.name, rows=sum(expected["rows"].values()), uploads=len(expected["uploads"]))
        finally:
            psql(cfg, f'DROP DATABASE "{database}" WITH (FORCE);', database="postgres")


def mark_live(args):
    cfg = load()
    if cfg["stage"] != "migrated":
        raise OpsError("Stato migrazione inatteso.")
    with urllib.request.urlopen(cfg["app_origin"] + "/api/health/ready", timeout=10) as response:
        if json.load(response).get("status") != "ready":
            raise OpsError("Readiness pubblica non verificata.")
    if row_counts(cfg) != cfg["migration_counts"]:
        raise OpsError("Dati cambiati: verifica prima di finalizzare.")
    root = docker("volume", "inspect", cfg["volume"], "--format", "{{.Mountpoint}}")
    if uploads_manifest(Path(root) / "uploads") != cfg["legacy_uploads"]:
        raise OpsError("Allegati diversi dal manifest legacy.")
    cfg.update({"stage": "live", "maintenance": False})
    save(cfg)
    event("migration_live", database="postgresql", uploads_verified=True)


def monitor(args):
    cfg = load()
    if cfg["maintenance"] or maintenance_active():
        event("monitor_maintenance")
        return
    issues = []
    try:
        with urllib.request.urlopen(cfg["app_origin"] + "/api/health/ready", timeout=10) as response:
            if json.load(response).get("status") != "ready":
                issues.append("readiness")
    except Exception:
        issues.append("readiness")
    try:
        last = json.loads((STATE / "last-backup.json").read_text())
        if time.time() - last["created"] > 36 * 3600:
            issues.append("backup_age")
    except (OSError, ValueError):
        issues.append("backup_missing")
    try:
        restored = json.loads((STATE / "last-restore.json").read_text())
        if time.time() - restored["checked"] > 8 * 86400:
            issues.append("restore_age")
    except (OSError, ValueError):
        issues.append("restore_missing")
    usage = shutil.disk_usage(STATE)
    if usage.used / usage.total >= .8:
        issues.append("disk_usage")
    if issues and maintenance_active():
        event("monitor_maintenance")
        return
    private_json(STATE / "monitor.json", {"checked": time.time(), "issues": issues})
    event("monitor_failed" if issues else "monitor_ok", issues=issues)
    if issues:
        raise OpsError("Monitor rileva un problema; consultare il journal Elettra.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    init = sub.add_parser("prepare")
    init.add_argument("--app", required=True)
    init.add_argument("--app-id", type=int, required=True)
    init.add_argument("--database", required=True)
    init.add_argument("--environment", type=int, required=True)
    change = sub.add_parser("cutover")
    change.add_argument("--image", default="elettra-crm:production")
    for name in ["backup", "restore-check", "mark-live", "monitor"]:
        sub.add_parser(name)
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise OpsError("Le operazioni host devono essere eseguite come root.")
    os.umask(0o077)
    {"prepare": prepare, "cutover": cutover, "backup": backup,
     "restore-check": restore_check, "mark-live": mark_live, "monitor": monitor}[args.command](args)


if __name__ == "__main__":
    try:
        main()
    except (OpsError, OSError, subprocess.TimeoutExpired) as error:
        event("operation_failed", reason=str(error) if isinstance(error, OpsError) else type(error).__name__)
        raise SystemExit(1)
