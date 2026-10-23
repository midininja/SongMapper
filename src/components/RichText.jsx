// Renders an array of text segments with formatting from the Google Doc.
// Segment: { t: text, k?: key-term (blue bold), p?: purple, l?: link URL }

const COLORS = {
  body: "#1c4587",
  keyTerm: "#1c4587",
  purple: "#9900ff",
  link: "#1c4587",
};

export default function RichText({ segments, style }) {
  if (!segments || segments.length === 0) return null;

  return (
    <span style={{ color: COLORS.body, ...style }}>
      {segments.map((seg, i) => {
        let el = seg.t;

        if (seg.l) {
          el = (
            <a
              key={i}
              href={seg.l}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: COLORS.link,
                textDecoration: "underline",
                fontWeight: seg.k ? "bold" : "normal",
                fontStyle: seg.i ? "italic" : "normal",
              }}
            >
              {seg.t}
            </a>
          );
        } else if (seg.p) {
          el = (
            <span key={i} style={{ color: COLORS.purple, fontWeight: "bold" }}>
              {seg.t}
            </span>
          );
        } else if (seg.k && seg.i) {
          el = (
            <span key={i} style={{ color: COLORS.keyTerm, fontWeight: "bold", fontStyle: "italic" }}>
              {seg.t}
            </span>
          );
        } else if (seg.k) {
          el = (
            <span key={i} style={{ color: COLORS.keyTerm, fontWeight: "bold" }}>
              {seg.t}
            </span>
          );
        } else if (seg.i) {
          el = (
            <span key={i} style={{ fontStyle: "italic" }}>
              {seg.t}
            </span>
          );
        } else {
          el = <span key={i}>{seg.t}</span>;
        }

        return el;
      })}
    </span>
  );
}