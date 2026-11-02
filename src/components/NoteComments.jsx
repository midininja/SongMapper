import { createContext, useContext, useEffect, useState } from "react";

const CommentsContext = createContext(null);

export function useComments() {
  return useContext(CommentsContext);
}

const UI_ATTR = "data-comment-ui";
const POPOVER_WIDTH = 280;
const ACCENT = "#0a5cd6";

const menuButtonStyle = {
  background: "#e0e0e0", color: "#333", border: "none", borderRadius: 3,
  padding: "3px 8px", fontSize: 11, cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap",
};
const smallButtonStyle = {
  background: "transparent", border: "none", cursor: "pointer", color: ACCENT,
  fontSize: 11, fontWeight: "bold", padding: "2px 4px",
};

function wrapRange(range, cid) {
  const mark = document.createElement("span");
  mark.className = "sm-comment";
  mark.dataset.cid = cid;
  try {
    range.surroundContents(mark);
  } catch {
    mark.appendChild(range.extractContents());
    range.insertNode(mark);
  }
  const button = document.createElement("span");
  button.className = "sm-comment-btn";
  button.dataset.cbtn = cid;
  button.contentEditable = "false";
  mark.after(button);
}

function threadPosition(thread) {
  const left = Math.min(thread.editorRect.right + 8, window.innerWidth - POPOVER_WIDTH - 8);
  const top = Math.max(8, Math.min(thread.anchor.top - 8, window.innerHeight - 320));
  return { left: Math.max(8, left), top };
}

export function CommentsProvider({ comments, setComments, children }) {
  const [menu, setMenu] = useState(null);
  const [thread, setThread] = useState(null);

  useEffect(() => {
    if (!menu && !thread) return;
    const close = () => { setMenu(null); setThread(null); };
    const onPointerDown = (e) => { if (!e.target.closest?.(`[${UI_ATTR}]`)) close(); };
    const onScroll = (e) => { if (!(e.target instanceof Element && e.target.closest(`[${UI_ATTR}]`))) close(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, thread]);

  function openMenu(e) {
    const sel = window.getSelection();
    const editor = e.currentTarget;
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !editor.contains(sel.anchorNode)) return;
    e.preventDefault();
    e.stopPropagation();
    setThread(null);
    setMenu({ x: e.clientX, y: e.clientY, editor, range: sel.getRangeAt(0).cloneRange() });
  }

  function openFromClick(e) {
    const button = e.target.closest?.("[data-cbtn]");
    if (!button) return;
    e.preventDefault();
    setMenu(null);
    setThread({ cid: button.dataset.cbtn, anchor: button.getBoundingClientRect(), editorRect: e.currentTarget.getBoundingClientRect() });
  }

  function startComment() {
    const { editor, range } = menu;
    const cid = `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setMenu(null);
    wrapRange(range, cid);
    window.getSelection()?.removeAllRanges();
    setComments(prev => ({ ...prev, [cid]: [] }));
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    const button = editor.querySelector(`[data-cbtn="${cid}"]`);
    if (button) setThread({ cid, anchor: button.getBoundingClientRect(), editorRect: editor.getBoundingClientRect() });
  }

  function addComment(cid, text) {
    setComments(prev => ({ ...prev, [cid]: [...(prev[cid] || []), { id: `m-${Date.now()}`, text, createdAt: Date.now() }] }));
  }
  function editComment(cid, id, text) {
    setComments(prev => ({ ...prev, [cid]: (prev[cid] || []).map(c => c.id === id ? { ...c, text, editedAt: Date.now() } : c) }));
  }
  function deleteComment(cid, id) {
    setComments(prev => ({ ...prev, [cid]: (prev[cid] || []).filter(c => c.id !== id) }));
  }

  return (
    <CommentsContext.Provider value={{ openMenu, openFromClick }}>
      {children}
      {menu && (
        <div {...{ [UI_ATTR]: "" }} style={{ position: "fixed", left: menu.x, top: menu.y, zIndex: 9000, background: "#fff", border: "1px solid #d0d0d0", borderRadius: 5, boxShadow: "0 4px 16px rgba(0,0,0,0.25)", padding: 4 }}>
          <button onMouseDown={e => e.preventDefault()} onClick={startComment} style={menuButtonStyle}>Comment</button>
        </div>
      )}
      {thread && (
        <CommentThreadBox
          key={thread.cid}
          position={threadPosition(thread)}
          comments={comments[thread.cid] || []}
          onAdd={text => addComment(thread.cid, text)}
          onEdit={(id, text) => editComment(thread.cid, id, text)}
          onDelete={id => deleteComment(thread.cid, id)}
          onClose={() => setThread(null)}
        />
      )}
    </CommentsContext.Provider>
  );
}

function CommentThreadBox({ position, comments, onAdd, onEdit, onDelete, onClose }) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [hoverId, setHoverId] = useState(null);

  function submitAdd() {
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft("");
  }
  function submitEdit() {
    const text = editText.trim();
    if (!text) return;
    onEdit(editingId, text);
    setEditingId(null);
  }

  return (
    <div
      {...{ [UI_ATTR]: "" }}
      style={{ position: "fixed", left: position.left, top: position.top, width: POPOVER_WIDTH, maxHeight: 320, zIndex: 9000, display: "flex", flexDirection: "column", background: "#fff", color: "#0f0f0f", border: "1px solid #c8c8c8", borderRadius: 6, boxShadow: "0 6px 20px rgba(0,0,0,0.25)", fontSize: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderBottom: "1px solid #e0e0e0" }}>
        <span style={{ fontWeight: "bold" }}>Comments ({comments.length})</span>
        <button onClick={onClose} title="Close" style={{ ...smallButtonStyle, color: "#555" }}>✕</button>
      </div>

      <div style={{ overflowY: "auto", padding: "6px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
        {comments.length === 0 && <span style={{ color: "#888", fontStyle: "italic" }}>No comments yet.</span>}
        {comments.map(c => (
          <div
            key={c.id}
            onMouseEnter={() => setHoverId(c.id)}
            onMouseLeave={() => setHoverId(null)}
            style={{ borderLeft: `3px solid ${ACCENT}`, paddingLeft: 8 }}
          >
            {editingId === c.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3} style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: 4, border: "1px solid #c8c8c8", borderRadius: 3, resize: "vertical" }} />
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => setEditingId(null)} style={smallButtonStyle}>Cancel</button>
                  <button onClick={submitEdit} disabled={!editText.trim()} style={{ ...smallButtonStyle, opacity: editText.trim() ? 1 : 0.4 }}>Save</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5, flex: 1 }}>{c.text}</p>
                  <div style={{ display: "flex", gap: 2, visibility: hoverId === c.id ? "visible" : "hidden" }}>
                    <button onClick={() => { setEditingId(c.id); setEditText(c.text); }} style={smallButtonStyle}>Edit</button>
                    <button onClick={() => onDelete(c.id)} style={{ ...smallButtonStyle, color: "#c0392b" }}>Delete</button>
                  </div>
                </div>
                <span style={{ fontSize: 10, color: "#777" }}>
                  {new Date(c.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                  {c.editedAt ? " (edited)" : ""}
                </span>
              </>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: "8px 10px", borderTop: "1px solid #e0e0e0", display: "flex", flexDirection: "column", gap: 6 }}>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Add a comment..." rows={2} style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: 4, border: "1px solid #c8c8c8", borderRadius: 3, resize: "vertical" }} />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={submitAdd} disabled={!draft.trim()} style={{ ...menuButtonStyle, background: ACCENT, color: "#fff", opacity: draft.trim() ? 1 : 0.4, cursor: draft.trim() ? "pointer" : "not-allowed" }}>Add comment</button>
        </div>
      </div>
    </div>
  );
}
