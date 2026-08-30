import { cn } from "../../utils/cn";

interface SectionHeadingRowProps {
  label: string;
  labelClassName: string;
  title: string;
  titleClassName: string;
  // Optional right-aligned second line under the kicker — a count, a
  // status, anything shorter than a second kicker deserves its own prop.
  meta?: string;
  metaClassName?: string;
}

export default function SectionHeadingRow({
  label,
  labelClassName,
  title,
  titleClassName,
  meta,
  metaClassName,
}: SectionHeadingRowProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className={titleClassName}>{title}</h2>
      <div className="flex flex-col items-end gap-1">
        <p className={cn(labelClassName)}>{label}</p>
        {meta ? <p className={cn(metaClassName)}>{meta}</p> : null}
      </div>
    </div>
  );
}
