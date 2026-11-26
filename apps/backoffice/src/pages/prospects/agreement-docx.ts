import JSZip from "jszip";

/**
 * The firm's Word agreement, drawn in the Agreement tab with its own fields typed into in place (25 Nov 2026, kept on
 * localhost for now). Every content control ("Click or tap here to enter text") is a text field t0, t1, …; every Word
 * form tick box c0, c1, …; every Word form text box f0, f1, …, numbered in the file's own order, so what is typed goes
 * back into the same field when the file is downloaded.
 */
export type AgreementValues = Record<string, string | boolean>;

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const MARK = /⟦([tcf])(\d+)⟧/;

async function documentXml(zip: JSZip) {
  const text = await zip.file("word/document.xml")!.async("string");
  return new DOMParser().parseFromString(text, "application/xml");
}

/** The content controls that hold text themselves, not the ones wrapped around others. */
const innermost = (doc: Document) => [...doc.getElementsByTagName("w:sdt")].filter((one) => one.getElementsByTagName("w:sdt").length === 0);

/** The start of each Word form field of a kind: w:checkBox for a tick box, w:textInput for a text box. */
const formFields = (doc: Document, kind: string) => [...doc.getElementsByTagName("w:fldChar")]
  .filter((one) => one.getAttribute("w:fldCharType") === "begin" && one.getElementsByTagName(kind).length > 0);

const texts = (element: Element) => [...element.getElementsByTagName("w:t")];

/** The viewer skips text in a run that carries a field, so the marker goes in a run of its own just before it. */
function marker(doc: Document, field: Element, text: string) {
  const run = field.parentNode!;
  const own = doc.createElementNS(W, "w:r");
  const style = (run as Element).getElementsByTagName("w:rPr")[0];
  if (style) own.appendChild(style.cloneNode(true));
  const t = doc.createElementNS(W, "w:t");
  t.textContent = text;
  own.appendChild(t);
  run.parentNode!.insertBefore(own, run);
}

/** A clause number as Word draws it: its text, and what follows it before the clause's own words. */
export type ListLabel = { text: string; suffix: string };

/** A list level as the file defines it in word/numbering.xml. */
type Level = { start: number; format: string; text: string; suffix: string; style: string | null; runProps: Element | null };

const child = (parent: Element | null | undefined, tag: string): Element | null =>
  (parent ? [...parent.children].find((one) => one.tagName === tag) ?? null : null);
const val = (element: Element | null) => element?.getAttribute("w:val") ?? null;

const ROMAN: [number, string][] = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"],
  [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];

/** A count written in a level's own format: 3, c, iii, C, III. */
function formatted(value: number, format: string): string {
  switch (format) {
    case "lowerLetter":
    case "upperLetter": {
      // Word goes a … z, then aa … zz.
      const letter = String.fromCharCode(97 + ((value - 1) % 26)).repeat(Math.ceil(value / 26));
      return format === "upperLetter" ? letter.toUpperCase() : letter;
    }
    case "lowerRoman":
    case "upperRoman": {
      let left = value;
      let roman = "";
      for (const [worth, letters] of ROMAN) {
        while (left >= worth) {
          roman += letters;
          left -= worth;
        }
      }
      return format === "upperRoman" ? roman.toUpperCase() : roman;
    }
    case "decimalZero":
      return value < 10 ? `0${value}` : String(value);
    case "none":
      return "";
    default:
      return String(value);
  }
}

/** The file's bullets are Symbol and Wingdings characters, which a browser has no font for. */
const BULLETS: Record<string, string> = { "\uf0b7": "•", "\uf0a7": "▪", "\uf0d8": "➢", "\uf076": "❖", "\uf0fc": "✓", "\uf0a8": "□" };

/**
 * Every numbered paragraph's number worked out as Word works it out (25 Nov 2026), from the file's own lists and styles:
 * each level counts on from its start, a level starts again after any level above it, and the number is written by
 * the level's own pattern ("%1.%2" → 3.9). The viewer's own counting split a clause where Word had ended a page and
 * numbered the rest again (3.9 → 3.10), so the numbers are written here instead, and the viewer's are not drawn.
 * A marker run is put at the start of each numbered paragraph, in the paragraph mark's formatting with the level's
 * own on top, as Word formats a number.
 */
function numberedInPlace(doc: Document, numbering: Document | null, styles: Document | null): ListLabel[] {
  if (!numbering) return [];
  const abstracts = new Map<string, Level[]>();
  for (const abstract of numbering.getElementsByTagName("w:abstractNum")) {
    const levels: Level[] = [];
    for (const lvl of [...abstract.children].filter((one) => one.tagName === "w:lvl")) {
      levels[Number(lvl.getAttribute("w:ilvl"))] = {
        start: Number(val(child(lvl, "w:start")) ?? 0),
        format: val(child(lvl, "w:numFmt")) ?? "decimal",
        text: val(child(lvl, "w:lvlText")) ?? "",
        suffix: val(child(lvl, "w:suff")) ?? "tab",
        style: val(child(lvl, "w:pStyle")),
        runProps: child(lvl, "w:rPr"),
      };
    }
    abstracts.set(abstract.getAttribute("w:abstractNumId") ?? "", levels);
  }
  const lists = new Map<string, string>();
  for (const num of numbering.getElementsByTagName("w:num")) {
    const abstract = val(child(num, "w:abstractNumId"));
    if (abstract != null) lists.set(num.getAttribute("w:numId") ?? "", abstract);
  }
  // A paragraph style may carry the numbering itself, directly or through the style it is based on.
  const paragraphStyles = new Map<string, { basedOn: string | null; numId: string | null; ilvl: string | null }>();
  let defaultStyle: string | null = null;
  for (const style of styles?.getElementsByTagName("w:style") ?? []) {
    if (style.getAttribute("w:type") !== "paragraph") continue;
    const id = style.getAttribute("w:styleId") ?? "";
    if (style.getAttribute("w:default") === "1") defaultStyle = id;
    const numPr = child(child(style, "w:pPr"), "w:numPr");
    paragraphStyles.set(id, { basedOn: val(child(style, "w:basedOn")), numId: val(child(numPr, "w:numId")), ilvl: val(child(numPr, "w:ilvl")) });
  }
  const fromStyle = (id: string | null) => {
    let numId: string | null = null;
    let ilvl: string | null = null;
    const seen = new Set<string>();
    for (let at = id; at != null && !seen.has(at); at = paragraphStyles.get(at)?.basedOn ?? null) {
      seen.add(at);
      numId ??= paragraphStyles.get(at)?.numId ?? null;
      ilvl ??= paragraphStyles.get(at)?.ilvl ?? null;
    }
    return { numId, ilvl };
  };

  const counts = new Map<string, (number | undefined)[]>();
  const labels: ListLabel[] = [];
  for (const paragraph of [...doc.getElementsByTagName("w:p")]) {
    const pPr = child(paragraph, "w:pPr");
    const direct = child(pPr, "w:numPr");
    const styleId = val(child(pPr, "w:pStyle")) ?? defaultStyle;
    const styled = fromStyle(styleId);
    const numId = val(child(direct, "w:numId")) ?? styled.numId;
    const abstract = numId == null || numId === "0" ? undefined : lists.get(numId);
    const levels = abstract == null ? undefined : abstracts.get(abstract);
    if (abstract == null || !levels) continue;
    const linked = levels.findIndex((one) => one?.style != null && one.style === styleId);
    const ilvl = Number(val(child(direct, "w:ilvl")) ?? styled.ilvl ?? (linked >= 0 ? linked : 0));
    const level = levels[ilvl];
    if (!level) continue;
    const count = counts.get(abstract) ?? [];
    counts.set(abstract, count);
    // A level above that has not been used yet counts as used at its start, as in Word: a list whose first
    // paragraph is "2.3" (level 1 starting at 3, level 0 at 2) goes on to "3" at its next level-0 paragraph.
    for (let above = 0; above < ilvl; above++) count[above] ??= levels[above]?.start ?? 0;
    count[ilvl] = count[ilvl] === undefined ? level.start : count[ilvl] + 1;
    for (let deeper = ilvl + 1; deeper < 9; deeper++) count[deeper] = undefined;
    const bullet = level.format === "bullet";
    const text = hiddenNumber(paragraph) ? "" : bullet ? (BULLETS[level.text] ?? level.text)
      : level.text.replace(/%([1-9])/g, (_, k: string) => {
        const at = Number(k) - 1;
        return formatted(count[at] ?? levels[at]?.start ?? 0, levels[at]?.format ?? "decimal");
      });
    labels.push({ text, suffix: level.suffix });

    // The number's own run: the paragraph mark's formatting, the level's on top.
    const props = (child(pPr, "w:rPr")?.cloneNode(true) as Element | undefined) ?? doc.createElementNS(W, "w:rPr");
    for (const gone of [...props.children].filter((one) => ["w:ins", "w:del", "w:moveFrom", "w:moveTo", "w:rPrChange", "w:vanish", "w:specVanish"].includes(one.tagName))) gone.remove();
    for (const own of [...(level.runProps?.children ?? [])]) {
      for (const same of [...props.children].filter((one) => one.tagName === own.tagName)) same.remove();
      props.appendChild(own.cloneNode(true));
    }
    if (bullet) for (const font of [...props.children].filter((one) => one.tagName === "w:rFonts")) font.remove();
    const run = doc.createElementNS(W, "w:r");
    run.appendChild(props);
    const t = doc.createElementNS(W, "w:t");
    t.textContent = `⟦n${labels.length - 1}⟧`;
    run.appendChild(t);
    paragraph.insertBefore(run, pPr ? pPr.nextSibling : paragraph.firstChild);
  }
  return labels;
}

/** Whether the paragraph sits in a table cell. */
const inTable = (element: Element) => {
  for (let at = element.parentElement; at; at = at.parentElement) if (at.tagName === "w:tc") return true;
  return false;
};

/**
 * A numbered paragraph in a table cell that starts with a page break shows no number in Word, though it is counted:
 * Schedule 6's "Excluded Jurisdictions", "Excluded Sectors/ Industries" and "Extenuating Circumstances" bars print
 * without III., IV. and V. (VI. follows), and "What is the highest level of education…" without 1. (2. follows), as
 * Word's own PDF of the file shows (25 Nov 2026).
 */
function hiddenNumber(paragraph: Element): boolean {
  if (!inTable(paragraph)) return false;
  for (const run of [...paragraph.children].filter((one) => one.tagName === "w:r")) {
    for (const part of [...run.children]) {
      if (["w:rPr", "w:lastRenderedPageBreak"].includes(part.tagName)) continue;
      return part.tagName === "w:br" && part.getAttribute("w:type") === "page";
    }
  }
  return false;
}

/** Word does not break a page inside a table cell, so a page break there is not drawn. */
function noPageBreaksInTables(doc: Document) {
  for (const brk of [...doc.getElementsByTagName("w:br")]) {
    if (brk.getAttribute("w:type") === "page" && inTable(brk)) brk.remove();
  }
}

async function xmlIn(zip: JSZip, path: string) {
  const text = await zip.file(path)?.async("string");
  return text ? new DOMParser().parseFromString(text, "application/xml") : null;
}

/**
 * A run holding a field's marks together with words is split, a run for each part, with the same formatting: the
 * viewer leaves out every word of a run that holds a field mark, and clause 13.2 ("Without prejudice to the generality
 * of Clause 13.1, …") was missing from the screen because its cross-reference sat in the same run as its words.
 */
function fieldsInRunsOfTheirOwn(doc: Document) {
  for (const run of [...doc.getElementsByTagName("w:r")]) {
    const parts = [...run.children].filter((one) => one.tagName !== "w:rPr");
    const marks = parts.filter((one) => one.tagName === "w:fldChar" || one.tagName === "w:instrText");
    if (marks.length === 0 || parts.length === marks.length && marks.length === 1) continue;
    const props = child(run, "w:rPr");
    for (const part of parts) {
      const own = doc.createElementNS(W, "w:r");
      if (props) own.appendChild(props.cloneNode(true));
      own.appendChild(part);
      run.parentNode!.insertBefore(own, run);
    }
    run.remove();
  }
}

/**
 * Pictures a browser cannot draw, by their name in the file's media folder, each with Word's own drawing of it: the
 * risk-profile matrix in Schedule 6 is an EMF, which no browser shows, so the screen had an empty box where Word
 * shows the grid. Only the screen's copy changes; Download Word keeps the file's own picture.
 */
export type StandIns = Record<string, Blob>;

async function picturesTheBrowserCanDraw(zip: JSZip, standIns: StandIns) {
  const relsPath = "word/_rels/document.xml.rels";
  const rels = await xmlIn(zip, relsPath);
  if (!rels) return;
  let changed = false;
  for (const rel of [...rels.getElementsByTagName("Relationship")]) {
    const target = rel.getAttribute("Target") ?? "";
    const standIn = standIns[target.split("/").pop() ?? ""];
    if (!standIn) continue;
    const png = target.replace(/\.[^./]+$/, ".png");
    zip.file(`word/${png}`, standIn);
    rel.setAttribute("Target", png);
    changed = true;
  }
  if (!changed) return;
  zip.file(relsPath, new XMLSerializer().serializeToString(rels));
  const types = await xmlIn(zip, "[Content_Types].xml");
  if (types && ![...types.getElementsByTagName("Default")].some((one) => one.getAttribute("Extension") === "png")) {
    const png = types.createElementNS(types.documentElement.namespaceURI, "Default");
    png.setAttribute("Extension", "png");
    png.setAttribute("ContentType", "image/png");
    types.documentElement.appendChild(png);
    zip.file("[Content_Types].xml", new XMLSerializer().serializeToString(types));
  }
}

/** The file with a marker where each field and each clause number is, and what each field holds in the file itself. */
export async function prepared(file: Blob, standIns: StandIns = {}): Promise<{ file: Blob; start: AgreementValues; labels: ListLabel[] }> {
  const zip = await JSZip.loadAsync(file);
  await picturesTheBrowserCanDraw(zip, standIns);
  const doc = await documentXml(zip);
  fieldsInRunsOfTheirOwn(doc);
  const start: AgreementValues = {};
  innermost(doc).forEach((sdt, at) => {
    const shown = texts(sdt.getElementsByTagName("w:sdtContent")[0]!);
    const placeholder = sdt.getElementsByTagName("w:showingPlcHdr").length > 0;
    start[`t${at}`] = placeholder ? "" : shown.map((t) => t.textContent).join("");
    shown.forEach((t, n) => { t.textContent = n === 0 ? `⟦t${at}⟧` : ""; });
  });
  formFields(doc, "w:checkBox").forEach((field, at) => {
    const box = field.getElementsByTagName("w:checkBox")[0]!;
    const set = box.getElementsByTagName("w:checked")[0] ?? box.getElementsByTagName("w:default")[0];
    start[`c${at}`] = set?.getAttribute("w:val") === "1";
    marker(doc, field, `⟦c${at}⟧`);
  });
  formFields(doc, "w:textInput").forEach((field, at) => {
    start[`f${at}`] = "";
    marker(doc, field, `⟦f${at}⟧`);
  });
  const labels = numberedInPlace(doc, await xmlIn(zip, "word/numbering.xml"), await xmlIn(zip, "word/styles.xml"));
  noPageBreaksInTables(doc);
  zip.file("word/document.xml", new XMLSerializer().serializeToString(doc));
  return { file: await zip.generateAsync({ type: "blob" }), start, labels };
}

/** Word's default tab stops, half an inch apart, in screen pixels. */
const DEFAULT_TAB = 48;

/**
 * Each clause number written in where its marker is, in place of the viewer's own: then the clause's words start
 * where Word starts them, at the hanging indent, or at the next tab stop when the number is wider than the indent.
 * The drawn file must be laid out (not display: none) for the widths to be measured.
 */
export function numbered(root: HTMLElement, labels: ListLabel[]): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits: Text[] = [];
  const NUMBER = /⟦n(\d+)⟧/;
  while (walker.nextNode()) if (NUMBER.test(walker.currentNode.nodeValue ?? "")) hits.push(walker.currentNode as Text);
  const placed: { span: HTMLElement; paragraph: HTMLElement | null; label: ListLabel }[] = [];
  for (const node of hits) {
    const [whole, n] = (node.nodeValue ?? "").match(NUMBER)!;
    const label = labels[Number(n)] ?? { text: "", suffix: "nothing" };
    const [before, after] = (node.nodeValue ?? "").split(whole!);
    const span = document.createElement("span");
    span.className = "agreement-num";
    span.textContent = label.text + (label.suffix === "space" ? " " : "");
    const paragraph = node.parentElement?.closest("p") ?? null;
    paragraph?.classList.add("agreement-numbered");
    node.replaceWith(document.createTextNode(before ?? ""), span, document.createTextNode(after ?? ""));
    placed.push({ span, paragraph, label });
  }
  for (const { span, paragraph, label } of placed) {
    if (label.suffix !== "tab" || !paragraph) continue;
    const style = getComputedStyle(paragraph);
    const indent = parseFloat(style.textIndent) || 0;
    const width = span.getBoundingClientRect().width;
    const from = (parseFloat(style.marginLeft) || 0) + indent;
    // A hanging indent wide enough takes the words to it; otherwise the next default tab stop does.
    const room = -indent > width + 1 ? -indent : Math.ceil((from + width + 1) / DEFAULT_TAB) * DEFAULT_TAB - from;
    span.style.display = "inline-block";
    span.style.minWidth = `${room}px`;
  }
  return hits.length;
}

/**
 * Pages with nothing on them taken out: a break at the very top of a page starts no new page in Word, but the viewer
 * draws one.
 */
export function withoutEmptyPages(root: HTMLElement) {
  for (const page of [...root.querySelectorAll<HTMLElement>("section.docx")]) {
    const body = page.querySelector("article") ?? page;
    const shown = (body.textContent ?? "").replace(/\s/g, "") !== ""
      || body.querySelector("img, svg, canvas, table, input, .agreement-field, .agreement-num") !== null;
    if (!shown) page.remove();
  }
}

/**
 * Each marker in the drawn file made a field: a box to type into, or a tick box. Returns how many there are.
 * `changed` hears each change as it is made; a read-only agreement shows what was kept and takes no typing.
 */
export function editable(root: HTMLElement, start: AgreementValues, kept: AgreementValues, mayChange: boolean,
  changed: (key: string, value: string | boolean) => void): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits: Text[] = [];
  while (walker.nextNode()) if (MARK.test(walker.currentNode.nodeValue ?? "")) hits.push(walker.currentNode as Text);
  for (const node of hits) {
    const [whole, kind, n] = (node.nodeValue ?? "").match(MARK)!;
    const key = `${kind}${n}`;
    const [before, after] = (node.nodeValue ?? "").split(whole!);
    let field: HTMLElement;
    if (kind === "c") {
      const box = document.createElement("input");
      box.type = "checkbox";
      box.className = "agreement-box";
      box.checked = Boolean(kept[key] ?? start[key]);
      box.disabled = !mayChange;
      box.setAttribute("aria-label", "Tick box in the agreement");
      box.onchange = () => changed(key, box.checked);
      field = box;
    } else {
      const span = document.createElement("span");
      span.className = "agreement-field";
      span.contentEditable = mayChange ? "plaintext-only" : "false";
      span.setAttribute("role", "textbox");
      span.setAttribute("aria-label", "Field in the agreement");
      span.dataset.hint = mayChange ? "Type here" : "";
      span.textContent = String(kept[key] ?? start[key] ?? "");
      span.oninput = () => changed(key, span.textContent ?? "");
      field = span;
    }
    field.dataset.key = key;
    node.parentElement?.classList.remove("docx_placeholdertext");
    node.replaceWith(document.createTextNode(before ?? ""), field, document.createTextNode(after ?? ""));
  }
  return hits.length;
}

/** The firm's own file with what was typed and ticked written into its fields: it opens in Word filled in. */
export async function filled(file: Blob, values: AgreementValues): Promise<Blob> {
  const zip = await JSZip.loadAsync(file);
  const doc = await documentXml(zip);
  innermost(doc).forEach((sdt, at) => {
    const value = values[`t${at}`];
    if (typeof value !== "string" || value === "") return;
    texts(sdt.getElementsByTagName("w:sdtContent")[0]!).forEach((t, n) => {
      t.textContent = n === 0 ? value : "";
      if (n === 0) t.setAttribute("xml:space", "preserve");
    });
    [...sdt.getElementsByTagName("w:showingPlcHdr")].forEach((one) => one.remove());
    [...sdt.getElementsByTagName("w:rStyle")].filter((one) => one.getAttribute("w:val") === "PlaceholderText").forEach((one) => one.remove());
  });
  formFields(doc, "w:checkBox").forEach((field, at) => {
    const value = values[`c${at}`];
    if (typeof value !== "boolean") return;
    const box = field.getElementsByTagName("w:checkBox")[0]!;
    [...box.getElementsByTagName("w:checked")].forEach((one) => one.remove());
    const checked = doc.createElementNS(W, "w:checked");
    checked.setAttribute("w:val", value ? "1" : "0");
    box.appendChild(checked);
  });
  // A Word form text box: what was typed goes in as its result, between its separate and end marks.
  const all = [...doc.getElementsByTagName("*")];
  formFields(doc, "w:textInput").forEach((field, at) => {
    const value = values[`f${at}`];
    if (typeof value !== "string" || value === "") return;
    let separated = false;
    let first = true;
    for (let index = all.indexOf(field) + 1; index < all.length; index++) {
      const element = all[index]!;
      if (element.tagName === "w:fldChar") {
        const kind = element.getAttribute("w:fldCharType");
        if (kind === "separate") separated = true;
        if (kind === "end") break;
      } else if (separated && element.tagName === "w:t") {
        element.textContent = first ? value : "";
        if (first) element.setAttribute("xml:space", "preserve");
        first = false;
      }
    }
  });
  zip.file("word/document.xml", new XMLSerializer().serializeToString(doc));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
