import Link from "next/link";
import { Fragment } from "react";

function Inline({ text }: { text: string }) {
  return <>{text.split(/(\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link && /^\/(?!\/)[a-zA-Z0-9/?=&_%#.-]*$/.test(link[2])) return <Link key={i} href={link[2]} className="font-medium text-brand-deep underline underline-offset-2">{link[1]}</Link>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="rounded bg-paper px-1 font-mono text-[.9em]">{part.slice(1, -1)}</code>;
    return <Fragment key={i}>{part}</Fragment>;
  })}</>;
}
export default function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const bullet = line.match(/^([-*]|\d+\.)\s+(.+)/);
    if (bullet) {
      const items: string[] = [bullet[2]];
      while (i + 1 < lines.length && /^([-*]|\d+\.)\s+/.test(lines[i + 1].trim())) items.push(lines[++i].trim().replace(/^([-*]|\d+\.)\s+/, ""));
      blocks.push(<ul key={i} className="list-disc space-y-1 pl-5">{items.map((v, n) => <li key={n}><Inline text={v} /></li>)}</ul>);
    } else blocks.push(<p key={i} className={/^#+\s/.test(line) ? "pt-2 font-semibold" : ""}><Inline text={line.replace(/^#+\s+/, "")} /></p>);
  }
  return <div className="space-y-3 break-words leading-relaxed [overflow-wrap:anywhere]">{blocks}</div>;
}
