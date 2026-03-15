import { useState, useRef, useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen: boolean;
  badge?: number;
  children: ComponentChildren;
}

export default function CollapsibleSection({
  title,
  defaultOpen,
  badge,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const contentId = `collapsible-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const triggerId = `trigger-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const innerRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<string>(defaultOpen ? 'none' : '0px');

  useEffect(() => {
    if (expanded) {
      const el = innerRef.current;
      if (el) {
        setMaxHeight(`${el.scrollHeight}px`);
        // After transition, switch to 'none' so dynamic content isn't clipped
        const timer = setTimeout(() => setMaxHeight('none'), 300);
        return () => clearTimeout(timer);
      }
    } else {
      // Force a reflow so the transition from current height to 0 is visible
      const el = innerRef.current;
      if (el) {
        setMaxHeight(`${el.scrollHeight}px`);
        requestAnimationFrame(() => {
          setMaxHeight('0px');
        });
      }
    }
  }, [expanded]);

  return (
    <div className="mt-3">
      <button
        id={triggerId}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="w-full flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1"
      >
        <span className="flex items-center gap-2">
          <span
            className={`inline-block transition-transform duration-300 text-xs ${expanded ? 'rotate-90' : ''}`}
          >
            &#9656;
          </span>
          {title}
          {badge != null && badge > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-medium">
              {badge}
            </span>
          )}
        </span>
      </button>

      <div
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        ref={innerRef}
        className="overflow-hidden transition-all duration-300"
        style={{
          maxHeight: maxHeight,
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="pt-2">{children}</div>
      </div>
    </div>
  );
}
