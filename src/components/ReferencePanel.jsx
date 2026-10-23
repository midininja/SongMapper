import { useState } from "react";
import { SECTIONS } from "@/data/musicElements";
import RichText from "@/components/RichText";

const SECTION_BG = "#e8e8e8";
const CONCEPT_BG = "#f5f5f5";
const DETAIL_BG = "#ffffff";

// Group flat details into concepts.
// A new concept starts when an entry's first paragraph's first segment has p (purple).
function groupConcepts(details) {
  const concepts = [];
  let current = null;

  for (const entry of details) {
    const firstPara = entry[0];
    const firstSeg = firstPara?.[0];
    const isConceptStart = firstSeg?.p === true;

    if (isConceptStart) {
      const nameSegs = [];
      const defSegs = [];
      let inName = true;
      for (const seg of firstPara) {
        if (seg.p && inName) {
          nameSegs.push(seg);
        } else {
          inName = false;
          defSegs.push(seg);
        }
      }
      current = {
        name: nameSegs,
        definition: defSegs.filter(s => s.t.trim()),
        details: entry.slice(1),
      };
      concepts.push(current);
    } else if (current) {
      current.details.push(entry);
    } else {
      current = { name: [], definition: [], details: [entry] };
      concepts.push(current);
    }
  }

  return concepts;
}

function Row({ bg, children, onClick, expandable, expanded, bold, fontSize }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: bg,
        color: "#1c4587",
        padding: "5px 10px",
        fontSize: fontSize || 11,
        fontWeight: bold ? "bold" : "normal",
        lineHeight: 1.5,
        cursor: expandable ? "pointer" : "default",
        userSelect: "text",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        display: "flex",
        alignItems: "flex-start",
        gap: 4,
      }}
    >
      {expandable && (
        <span style={{ flexShrink: 0, fontSize: 8, marginTop: 3, opacity: 0.6 }}>
          {expanded ? "▼" : "▶"}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0, width: "100%", cursor: expandable ? "pointer" : "default" }}>{children}</div>
    </div>
  );
}

export default function ReferencePanel() {
  const [openSections, setOpenSections] = useState({});

  function toggleSection(idx) {
    setOpenSections(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{
        padding: "10px 10px 6px",
        fontSize: 9, color: "#ffffff",
        fontWeight: "bold", textTransform: "uppercase",
        letterSpacing: 1,
        background: "#34495e",
      }}>Music Elements Reference</div>
      {SECTIONS.map((section, sIdx) => {
        const concepts = groupConcepts(section.details);
        const isOpen = !!openSections[sIdx];
        return (
          <div key={sIdx} style={{ marginBottom: 2 }}>
            {/* Section heading: title + subtext in same panel.
                Collapsed = show subtext; Expanded = hide subtext, show concepts */}
            <Row
              bg={SECTION_BG}
              expandable
              expanded={isOpen}
              bold
              fontSize={13}
              onClick={() => toggleSection(sIdx)}
            >
              {section.title}
              {!isOpen && section.description && (
                <div style={{ fontSize: 11, fontWeight: "normal", marginTop: 2 }}>
                  {section.description}
                </div>
              )}
            </Row>
            {isOpen && concepts.map((concept, cIdx) => (
              <ConceptBlock key={cIdx} concept={concept} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ConceptBlock({ concept }) {
  const [open, setOpen] = useState(false);
  const hasName = concept.name.length > 0;

  return (
    <div>
      {/* Concept heading: name + definition in same panel.
          Collapsed = show definition; Expanded = hide definition, show details */}
      <Row
        bg={CONCEPT_BG}
        expandable={hasName}
        expanded={open}
        bold={hasName}
        fontSize={11}
        onClick={() => hasName && setOpen(o => !o)}
      >
        {hasName ? (
          <>
            <RichText segments={concept.name} />
            {!open && concept.definition.length > 0 && (
              <span style={{ fontWeight: "normal" }}> <RichText segments={concept.definition} /></span>
            )}
          </>
        ) : (
          concept.definition.length > 0 && <RichText segments={concept.definition} />
        )}
      </Row>
      {open && hasName && concept.details.map((entry, eIdx) => (
        <div key={eIdx}>
          {entry.map((para, pIdx) => (
            <Row key={pIdx} bg={DETAIL_BG} fontSize={11}>
              <RichText segments={para} />
            </Row>
          ))}
        </div>
      ))}
    </div>
  );
}