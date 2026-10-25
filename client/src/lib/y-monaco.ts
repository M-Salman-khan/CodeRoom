/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Y from "yjs";
import type { editor as MonacoEditor } from "monaco-editor";
import { createMutex } from "lib0/mutex";
import { Awareness } from "y-protocols/awareness";

class RelativeSelection {
  start: Y.RelativePosition;
  end: Y.RelativePosition;
  direction: any;

  constructor(start: Y.RelativePosition, end: Y.RelativePosition, direction: any) {
    this.start = start;
    this.end = end;
    this.direction = direction;
  }
}

const createRelativeSelection = (
  editor: MonacoEditor.IStandaloneCodeEditor,
  monacoModel: MonacoEditor.ITextModel,
  type: Y.Text
) => {
  const sel = editor.getSelection();
  if (sel !== null) {
    const startPos = sel.getStartPosition();
    const endPos = sel.getEndPosition();
    const start = Y.createRelativePositionFromTypeIndex(type, monacoModel.getOffsetAt(startPos));
    const end = Y.createRelativePositionFromTypeIndex(type, monacoModel.getOffsetAt(endPos));
    return new RelativeSelection(start, end, sel.getDirection());
  }
  return null;
};

const createMonacoSelectionFromRelativeSelection = (
  editor: MonacoEditor.IEditor,
  type: Y.Text,
  relSel: RelativeSelection,
  doc: Y.Doc,
  monaco: any
) => {
  const start = Y.createAbsolutePositionFromRelativePosition(relSel.start, doc);
  const end = Y.createAbsolutePositionFromRelativePosition(relSel.end, doc);
  if (start !== null && end !== null && start.type === type && end.type === type) {
    const model = editor.getModel() as MonacoEditor.ITextModel;
    const startPos = model.getPositionAt(start.index);
    const endPos = model.getPositionAt(end.index);
    return monaco.Selection.createWithDirection(
      startPos.lineNumber,
      startPos.column,
      endPos.lineNumber,
      endPos.column,
      relSel.direction
    );
  }
  return null;
};

export class MonacoBinding {
  doc: Y.Doc;
  ytext: Y.Text;
  monacoModel: MonacoEditor.ITextModel;
  editors: Set<MonacoEditor.IStandaloneCodeEditor>;
  awareness: Awareness | null;
  mux: ReturnType<typeof createMutex>;
  _savedSelections: Map<MonacoEditor.IStandaloneCodeEditor, RelativeSelection>;
  _beforeTransaction: () => void;
  _decorations: Map<MonacoEditor.IStandaloneCodeEditor, string[]>;
  _rerenderDecorations: () => void;
  _ytextObserver: (event: Y.YTextEvent) => void;
  _monacoChangeHandler: { dispose: () => void };
  _monacoDisposeHandler: { dispose: () => void };
  _cursorDisposables?: { dispose: () => void }[];
  _editorDisposables?: { dispose: () => void }[];
  monaco: any;

  constructor(
    ytext: Y.Text,
    monacoModel: MonacoEditor.ITextModel,
    editors: Set<MonacoEditor.IStandaloneCodeEditor> = new Set(),
    awareness: Awareness | null = null,
    monacoInstance?: any
  ) {
    this.doc = ytext.doc as Y.Doc;
    this.ytext = ytext;
    this.monacoModel = monacoModel;
    this.editors = editors;
    this.awareness = awareness;
    this.monaco = monacoInstance || (typeof window !== "undefined" ? (window as any).monaco : null);
    this.mux = createMutex();
    this._savedSelections = new Map();
    this._editorDisposables = [];

    this._beforeTransaction = () => {
      this.mux(() => {
        this._savedSelections = new Map();
        editors.forEach((editor) => {
          if (!editor || (editor as any)._isDisposed) return;
          if (editor.getModel() === monacoModel) {
            const rsel = createRelativeSelection(editor, monacoModel, ytext);
            if (rsel !== null) {
              this._savedSelections.set(editor, rsel);
            }
          }
        });
      });
    };

    this.doc.on("beforeAllTransactions", this._beforeTransaction);
    this._decorations = new Map();

    this._rerenderDecorations = () => {
      editors.forEach((editor) => {
        if (!editor || (editor as any)._isDisposed) return;
        if (awareness && editor.getModel() === monacoModel && this.monaco) {
          try {
            const currentDecorations = this._decorations.get(editor) || [];
            const newDecorations: MonacoEditor.IModelDeltaDecoration[] = [];

            awareness.getStates().forEach((state, clientID) => {
              if (
                clientID !== this.doc.clientID &&
                state.selection != null &&
                state.selection.anchor != null &&
                state.selection.head != null
              ) {
                const anchorAbs = Y.createAbsolutePositionFromRelativePosition(
                  state.selection.anchor,
                  this.doc
                );
                const headAbs = Y.createAbsolutePositionFromRelativePosition(
                  state.selection.head,
                  this.doc
                );
                if (
                  anchorAbs !== null &&
                  headAbs !== null &&
                  anchorAbs.type === ytext &&
                  headAbs.type === ytext
                ) {
                  let start: { lineNumber: number; column: number };
                  let end: { lineNumber: number; column: number };
                  let afterContentClassName: string | null = null;
                  let beforeContentClassName: string | null = null;

                  if (anchorAbs.index < headAbs.index) {
                    start = monacoModel.getPositionAt(anchorAbs.index);
                    end = monacoModel.getPositionAt(headAbs.index);
                    afterContentClassName = "yRemoteSelectionHead yRemoteSelectionHead-" + clientID;
                    beforeContentClassName = null;
                  } else {
                    start = monacoModel.getPositionAt(headAbs.index);
                    end = monacoModel.getPositionAt(anchorAbs.index);
                    afterContentClassName = null;
                    beforeContentClassName = "yRemoteSelectionHead yRemoteSelectionHead-" + clientID;
                  }

                  newDecorations.push({
                    range: new this.monaco.Range(
                      start.lineNumber,
                      start.column,
                      end.lineNumber,
                      end.column
                    ),
                    options: {
                      className: "yRemoteSelection yRemoteSelection-" + clientID,
                      afterContentClassName: afterContentClassName || undefined,
                      beforeContentClassName: beforeContentClassName || undefined,
                    },
                  });
                }
              }
            });

            this._decorations.set(
              editor,
              editor.deltaDecorations(currentDecorations, newDecorations)
            );
          } catch (err) {
            console.error("Error updating remote cursor decorations:", err);
          }
        } else {
          this._decorations.delete(editor);
        }
      });
    };

    this._ytextObserver = (event) => {
      this.mux(() => {
        try {
          const currentVal = monacoModel.getValue();
          const targetVal = ytext.toString();

          // If the model already matches the exact target text, avoid redundant delta application
          if (currentVal === targetVal) {
            return;
          }

          let index = 0;
          event.delta.forEach((op: any) => {
            if (op.retain !== undefined) {
              index += op.retain;
            } else if (op.insert !== undefined) {
              const pos = monacoModel.getPositionAt(index);
              const range = this.monaco
                ? new this.monaco.Selection(pos.lineNumber, pos.column, pos.lineNumber, pos.column)
                : ({
                    startLineNumber: pos.lineNumber,
                    startColumn: pos.column,
                    endLineNumber: pos.lineNumber,
                    endColumn: pos.column,
                  } as any);
              const insert = op.insert as string;
              monacoModel.applyEdits([{ range, text: insert }]);
              index += insert.length;
            } else if (op.delete !== undefined) {
              const pos = monacoModel.getPositionAt(index);
              const endPos = monacoModel.getPositionAt(index + op.delete);
              const range = this.monaco
                ? new this.monaco.Selection(pos.lineNumber, pos.column, endPos.lineNumber, endPos.column)
                : ({
                    startLineNumber: pos.lineNumber,
                    startColumn: pos.column,
                    endLineNumber: endPos.lineNumber,
                    endColumn: endPos.column,
                  } as any);
              monacoModel.applyEdits([{ range, text: "" }]);
            }
          });

          // Safeguard: Ensure model strictly matches ytext and never duplicates
          if (monacoModel.getValue() !== targetVal) {
            monacoModel.setValue(targetVal);
          }

          if (this.monaco) {
            this._savedSelections.forEach((rsel, editor) => {
              if (!editor || (editor as any)._isDisposed) return;
              try {
                const sel = createMonacoSelectionFromRelativeSelection(
                  editor,
                  ytext,
                  rsel,
                  this.doc,
                  this.monaco
                );
                if (sel !== null) {
                  editor.setSelection(sel);
                }
              } catch {}
            });
          }
        } catch (err) {
          console.error("Error applying Yjs updates to Monaco model:", err);
        }
      });

      this._rerenderDecorations();
    };

    ytext.observe(this._ytextObserver);

    this.mux(() => {
      const ytextValue = ytext.toString();
      if (monacoModel.getValue() !== ytextValue) {
        monacoModel.setValue(ytextValue);
      }
    });

    this._monacoChangeHandler = monacoModel.onDidChangeContent((event) => {
      this.mux(() => {
        try {
          this.doc.transact(() => {
            event.changes
              .slice()
              .sort((change1, change2) => change2.rangeOffset - change1.rangeOffset)
              .forEach((change) => {
                const currentLen = ytext.length;
                if (change.rangeOffset <= currentLen) {
                  const delLen = Math.min(change.rangeLength, currentLen - change.rangeOffset);
                  if (delLen > 0) {
                    ytext.delete(change.rangeOffset, delLen);
                  }
                  if (change.text.length > 0) {
                    ytext.insert(change.rangeOffset, change.text);
                  }
                } else {
                  ytext.insert(currentLen, change.text);
                }
              });
          }, this);
        } catch (err) {
          console.error("Error applying Monaco edits to Yjs text:", err);
        }
      });
    });

    this._monacoDisposeHandler = monacoModel.onWillDispose(() => {
      this.destroy();
    });

    if (awareness) {
      editors.forEach((editor) => {
        if (!editor || (editor as any)._isDisposed) return;
        const cursorSub = editor.onDidChangeCursorSelection(() => {
          if ((editor as any)._isDisposed) return;
          if (editor.getModel() === monacoModel) {
            const sel = editor.getSelection();
            if (sel === null) return;
            let anchor = monacoModel.getOffsetAt(sel.getStartPosition());
            let head = monacoModel.getOffsetAt(sel.getEndPosition());
            if (
              this.monaco &&
              sel.getDirection() === this.monaco.SelectionDirection?.RTL
            ) {
              const tmp = anchor;
              anchor = head;
              head = tmp;
            }
            awareness.setLocalStateField("selection", {
              anchor: Y.createRelativePositionFromTypeIndex(ytext, anchor),
              head: Y.createRelativePositionFromTypeIndex(ytext, head),
            });
          }
        });
        this._editorDisposables?.push(cursorSub);
      });
      awareness.on("change", this._rerenderDecorations);
    }
  }

  destroy() {
    this._monacoChangeHandler?.dispose();
    this._monacoDisposeHandler?.dispose();
    this._editorDisposables?.forEach((d) => {
      try {
        d.dispose();
      } catch {}
    });
    this._editorDisposables = [];
    this.ytext.unobserve(this._ytextObserver);
    this.doc.off("beforeAllTransactions", this._beforeTransaction);
    if (this.awareness) {
      this.awareness.off("change", this._rerenderDecorations);
    }
    this.editors.forEach((editor) => {
      if (editor && !(editor as any)._isDisposed) {
        try {
          const current = this._decorations.get(editor) || [];
          if (current.length > 0) {
            editor.deltaDecorations(current, []);
          }
        } catch {}
      }
    });
    this._decorations.clear();
  }
}
