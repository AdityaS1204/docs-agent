/**
 * GOOGLE DOCS AGENT — DOCUMENT SCHEMA
 * =====================================
 * This schema is passed to the LLM as a system prompt instruction.
 * The LLM must return a JSON object strictly conforming to this schema.
 * The executor reads this JSON and maps it to Google Docs API batchUpdate requests.
 *
 * OPERATION TYPES:
 *  - "create"  → Full new document generation
 *  - "patch"   → Replace/modify an existing block (identified by block_id)
 *  - "insert"  → Insert new blocks relative to an existing block
 *  - "append"  → Add blocks to end of document
 */

// ─────────────────────────────────────────────
// TOP-LEVEL RESPONSE SCHEMA
// ─────────────────────────────────────────────

const RESPONSE_SCHEMA = {
  operation: "create | patch | insert | append",       // REQUIRED always

  // ── Used only when operation = "create" ──
  document: {
    title: "string",                                    // Document title (shown in Google Docs header)

    format: [
      "article", "report", "essay", "thesis",
      "resume", "cover_letter", "proposal",
      "meeting_notes", "readme", "letter",
      "research_paper", "blog_post", "custom"
    ],

    page_setup: {
      page_size: "A4 | LETTER",                        // Default: LETTER
      orientation: "portrait | landscape",              // Default: portrait
      margin_top_inches: 1,                            // Default: 1
      margin_bottom_inches: 1,
      margin_left_inches: 1,
      margin_right_inches: 1,
      columns: 1,                                      // 1 or 2 column layout
    },

    default_style: {
      font_family: "Arial | Times New Roman | Calibri | Georgia | Roboto | Courier New",
      font_size_pt: 11,                                // Base font size in points
      line_spacing: 1.15,                              // Multiplier: 1, 1.15, 1.5, 2
      text_color: "#000000",                           // Hex color
      paragraph_spacing_after_pt: 10,                 // Space after each paragraph
    },

    // Optional document-level features
    options: {
      include_table_of_contents: false,               // Auto-generate TOC block
      include_page_numbers: false,                    // Add page numbers to footer
      page_number_alignment: "LEFT | CENTER | RIGHT", // Default: CENTER
      include_header: false,
      header_text: "string | null",
      include_footer: false,
      footer_text: "string | null",
    },

    blocks: [],                                       // Array of block objects (see below)
  },

  // ── Used only when operation = "patch" ──
  patch: {
    target_block_id: "string",                        // block_id of block to replace
    action: "replace | expand | summarize | rewrite", // What to do with the block
    blocks: [],                                       // New block(s) to replace target with
  },

  // ── Used only when operation = "insert" ──
  insert: {
    target_block_id: "string",                        // Reference block
    position: "before | after",                       // Where to insert relative to target
    blocks: [],                                       // Blocks to insert
  },

  // ── Used only when operation = "append" ──
  append: {
    blocks: [],                                       // Blocks to add to end of document
  },
};


// BLOCK SCHEMAS
// Each block must have a unique `block_id` (e.g. "b1", "b2" ...)
// and a `type` field. All other fields depend on type.


const BLOCK_SCHEMAS = {

  // ── 1. MAIN HEADING (use once per document) ──
  main_heading: {
    block_id: "string",                               // e.g. "b1" — unique, required
    type: "main_heading",
    content: "string",
    font_family: "string | null",                     // null = inherit document default
    font_size_pt: 26,
    font_color: "#hex | 'default'",
    bold: true,
    italic: false,
    underline: false,
    alignment: "LEFT | CENTER | RIGHT",
    spacing_before_pt: 0,
    spacing_after_pt: 12,
  },

  // ── 2. SUB HEADING (levels 1–3) ──
  sub_heading: {
    block_id: "string",
    type: "sub_heading",
    level: "1 | 2 | 3",                              // 1 = largest sub, 3 = smallest
    content: "string",
    font_family: "string | null",
    font_size_pt: null,                               // null = auto (H1:20, H2:16, H3:13)
    font_color: "#hex | 'default'",
    bold: true,
    italic: false,
    underline: false,
    alignment: "LEFT | CENTER | RIGHT",
    spacing_before_pt: 16,
    spacing_after_pt: 8,
  },

  // ── 3. PARAGRAPH ──
  paragraph: {
    block_id: "string",
    type: "paragraph",
    content: "string",                               // Full paragraph text
    font_family: "string | null",
    font_size_pt: null,                              // null = inherit default
    font_color: "#hex | 'default'",
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    alignment: "LEFT | RIGHT | CENTER | JUSTIFIED",
    line_spacing: null,                              // null = inherit default
    first_line_indent: false,                        // Indent first line (academic style)
    highlight_color: "#hex | null",                 // Background highlight for paragraph
    spacing_before_pt: 0,
    spacing_after_pt: 10,

    // Inline styles — for bolding/coloring specific words within the paragraph
    // start_index and end_index are character positions within `content` string
    inline_styles: [
      {
        start_index: "number",
        end_index: "number",
        bold: "boolean | null",
        italic: "boolean | null",
        underline: "boolean | null",
        strikethrough: "boolean | null",
        font_color: "#hex | null",
        highlight_color: "#hex | null",
        font_size_pt: "number | null",
        link_url: "string | null",                  // Makes this range a hyperlink
      }
    ],
  },

  // ── 4. BULLET LIST ──
  bullet_list: {
    block_id: "string",
    type: "bullet_list",
    bullet_style: "DISC | CIRCLE | SQUARE | ARROW | CHECKMARK",
    font_family: "string | null",
    font_size_pt: null,
    spacing_before_pt: 0,
    spacing_after_pt: 10,
    items: [
      {
        content: "string",
        indent_level: "0 | 1 | 2",                 // 0 = top level, 2 = deepest nested
        bold: false,
        italic: false,
        font_color: "#hex | 'default'",
        // Inline styles supported same as paragraph
        inline_styles: [],
      }
    ],
  },

  // ── 5. NUMBERED LIST ──
  numbered_list: {
    block_id: "string",
    type: "numbered_list",
    numbering_style: "DECIMAL | ALPHA_LOWER | ALPHA_UPPER | ROMAN_LOWER | ROMAN_UPPER",
    font_family: "string | null",
    font_size_pt: null,
    spacing_before_pt: 0,
    spacing_after_pt: 10,
    items: [
      {
        content: "string",
        indent_level: "0 | 1 | 2",
        bold: false,
        italic: false,
        font_color: "#hex | 'default'",
        inline_styles: [],
      }
    ],
  },

  // ── 6. TABLE ──
  table: {
    block_id: "string",
    type: "table",
    caption: "string | null",                       // Optional table caption above
    has_header_row: true,
    has_header_column: false,                       // First column acts as row labels
    border_color: "#CCCCCC",
    border_width_pt: 1,
    alignment: "LEFT | CENTER | RIGHT",             // Table alignment on page

    // Column width distribution (percentages, must sum to 100)
    column_widths_percent: [],                      // e.g. [30, 40, 30] for 3 cols

    // Cell alternating row color (zebra striping)
    stripe_rows: false,
    stripe_color: "#hex | null",

    header_style: {
      bg_color: "#hex | null",
      font_color: "#hex | 'default'",
      bold: true,
      alignment: "LEFT | CENTER | RIGHT",
    },

    // rows[i][j] = cell object
    cells: [
      [
        {
          content: "string",
          bold: false,
          italic: false,
          font_color: "#hex | 'default'",
          bg_color: "#hex | null",
          alignment: "LEFT | CENTER | RIGHT",
          vertical_alignment: "TOP | MIDDLE | BOTTOM",
          colspan: 1,                               // Merge across columns
          rowspan: 1,                               // Merge across rows
          inline_styles: [],
        }
      ]
    ],
  },

  // ── 7. CALLOUT / NOTICE BOX ──
  callout: {
    block_id: "string",
    type: "callout",
    style: "info | warning | tip | important | success | quote | danger",
    title: "string | null",                         // Optional bold title inside box
    content: "string",
    bg_color: "#hex | null",                        // null = auto based on style
    border_color: "#hex | null",                    // null = auto based on style
    border_side: "left | all",                      // left = accent bar, all = full border
    font_color: "#hex | 'default'",
    bold: false,
    italic: false,
    icon: "string | null",                          // emoji or null e.g. "⚠️"
  },

  // ── 8. CODE BLOCK ──
  code_block: {
    block_id: "string",
    type: "code_block",
    language: "python | javascript | typescript | sql | bash | json | html | css | java | go | rust | null",
    content: "string",                              // Raw code content
    show_line_numbers: false,
    font_family: "Courier New | Roboto Mono | Consolas",
    font_size_pt: 10,
    bg_color: "#F5F5F5",
    font_color: "#333333",
    caption: "string | null",                      // Caption below code block
  },

  // ── 9. BLOCKQUOTE ──
  blockquote: {
    block_id: "string",
    type: "blockquote",
    content: "string",
    attribution: "string | null",                  // "— Author Name, Source"
    font_family: "string | null",
    font_size_pt: null,
    font_color: "#hex | 'default'",
    italic: true,
    border_color: "#AAAAAA",
    indent_left_inches: 0.5,
    spacing_before_pt: 12,
    spacing_after_pt: 12,
  },

  // ── 10. IMAGE PLACEHOLDER ──
  // (Actual image binary handled separately; this reserves the space and stores metadata)
  image: {
    block_id: "string",
    type: "image",
    source: "url | upload",                        // "url" = fetch from URL, "upload" = user provided
    url: "string | null",                          // Required if source = "url"
    alt_text: "string",
    caption: "string | null",
    width_percent: 100,                            // Percentage of page content width
    alignment: "LEFT | CENTER | RIGHT",
    border: false,
    border_color: "#hex | null",
  },

  // ── 11. HORIZONTAL RULE ──
  horizontal_rule: {
    block_id: "string",
    type: "horizontal_rule",
    style: "solid | dashed | dotted | double",
    color: "#CCCCCC",
    thickness_pt: 1,
    width_percent: 100,
    spacing_before_pt: 12,
    spacing_after_pt: 12,
  },

  // ── 12. PAGE BREAK ──
  page_break: {
    block_id: "string",
    type: "page_break",
  },

  // ── 13. SPACER ──
  spacer: {
    block_id: "string",
    type: "spacer",
    height_pt: 24,                                 // Vertical whitespace
  },

  // ── 14. TABLE OF CONTENTS ──
  // (Auto-generated from heading blocks in document)
  table_of_contents: {
    block_id: "string",
    type: "table_of_contents",
    title: "Table of Contents",
    include_levels: [1, 2, 3],                     // Which heading levels to include
    show_page_numbers: true,
    font_family: "string | null",
  },

  // ── 15. EQUATION ──
  equation: {
    block_id: "string",
    type: "equation",
    content: "string",                             // LaTeX-style equation string
    display_mode: true,                            // true = block, false = inline
    alignment: "LEFT | CENTER | RIGHT",
    caption: "string | null",
  },

  // ── 16. KEY-VALUE / METADATA BLOCK ──
  // Useful for resumes, reports, proposal headers
  key_value: {
    block_id: "string",
    type: "key_value",
    layout: "vertical | horizontal | two_column",
    font_family: "string | null",
    font_size_pt: null,
    items: [
      {
        key: "string",
        value: "string",
        key_bold: true,
        key_color: "#hex | 'default'",
        value_color: "#hex | 'default'",
      }
    ],
  },

  // ── 17. FOOTNOTE REFERENCE ──
  // Inline reference within paragraph — use inline_styles link_url for simple footnotes
  // Use this block to define the footnote content at document bottom
  footnote: {
    block_id: "string",
    type: "footnote",
    footnote_id: "string",                         // Matches reference id in paragraph inline_style
    content: "string",
    font_size_pt: 9,
    italic: false,
  },

  // ── 18. CITATION / BIBLIOGRAPHY ENTRY ──
  citation: {
    block_id: "string",
    type: "citation",
    citation_style: "APA | MLA | Chicago | Harvard | IEEE | inline",
    entries: [
      {
        id: "string",                              // Short reference key e.g. "Smith2020"
        content: "string",                         // Fully formatted citation string
      }
    ],
    heading: "References | Bibliography | Works Cited | null",
    font_size_pt: 10,
    hanging_indent: true,                          // Standard for APA/MLA
  },

  // ── 19. COLUMNS BLOCK ──
  // Splits content into side-by-side columns within the block
  columns: {
    block_id: "string",
    type: "columns",
    num_columns: 2,                                // 2 or 3
    gap_inches: 0.3,
    column_widths_percent: [50, 50],               // Must sum to 100
    // Each column contains its own array of blocks
    columns_content: [
      {
        column_index: 0,
        blocks: [],                                // Any block types except nested columns
      }
    ],
  },
};


// SYSTEM PROMPT INSTRUCTIONS FOR LLM

const SYSTEM_PROMPT_INSTRUCTIONS = `
You are a Google Docs content generation agent. Your job is to generate document content 
as a strictly valid JSON object that matches the schema provided.

## CRITICAL RULES

1. ALWAYS return a single valid JSON object. No markdown, no explanation, no code fences.
2. ALWAYS include the "operation" field as the first key.
3. STRICT PROPERTY NAMES: Never use "align" (use "alignment"), never use "text" for main content (use "content"), never use "rows" for tables (use "cells").
4. TABLE STRUCTURE: The "cells" property in a table block MUST be a 2D array of CELL OBJECTS, not raw strings.
5. ALWAYS assign a unique block_id to every block (e.g. "b1", "b2", ...).
6. NEVER use "\\n" inside content strings — use separate blocks instead.
7. COMPREHENSIVENESS: Generate DEEP, LONG, and PROFESSIONAL documents. Do not summarize unless asked. A "report" should have multiple sections, sub-headings, and detailed paragraphs.

## BLOCK SELECTION GUIDELINES

- Use "main_heading" exactly ONCE per document (for the document title/main heading).
- Use "sub_heading" with appropriate levels (1, 2, 3) for document structure.
- Use "callout" for warnings, tips, important notices — not for regular content.
- Use "code_block" for any code, commands, or technical syntax.
- Use "table" for comparative or structured data — MUST follow the nested cells schema.
- Use "blockquote" for quotes from sources or people.
- Use "horizontal_rule" to visually separate major sections.
- Use "page_break" only when a section must start on a new page (e.g., appendices, chapters).
- Use "key_value" for metadata sections (author, date, version, contact info, etc.).
- Use inline_styles inside paragraphs to bold or highlight KEY TERMS — not decoratively.

## FORMATTING GUIDELINES

- Set font_color to "default" unless there is a semantic reason to use color.
- Set font_family to null unless overriding the document default is intentional.
- Set font_size_pt to null to inherit the document default.
- Use highlight_color sparingly — only for genuinely critical information.
- Prefer JUSTIFIED alignment for body paragraphs in formal documents.
- Prefer LEFT alignment for informal/blog/readme documents.
- For academic documents, set first_line_indent: true on body paragraphs.

## DOCUMENT FORMAT BEHAVIOR

Automatically adapt the schema usage based on detected document format:

- "thesis" / "research_paper": Include TOC, page numbers, citations, heading hierarchy, 
  first_line_indent on paragraphs, JUSTIFIED alignment, Times New Roman font. Ensure very long, academic depth.
  
- "report": Include TOC, page numbers, key_value header block (date, author, version),
  horizontal_rules between sections, tables for data, callouts for findings. Detailed and structured.
  
- "resume": Use key_value blocks for contact info, columns layout for skills,
  sub_headings for sections, bullet_lists for experience items. No TOC.
  
- "article" / "blog_post": Conversational tone, LEFT alignment, callouts for highlights,
  blockquotes for external references. Optional TOC.
  
- "meeting_notes": key_value for attendees/date, numbered_list for agenda,
  bullet_list for action items, callout (style: important) for decisions made.
  
- "proposal": key_value header, callout (style: info) for executive summary,
  table for budget/timeline, numbered_list for deliverables.

## EDIT OPERATIONS

When operation is "patch":
  - Target the exact block_id given.
  - Return replacement blocks that preserve the document's formatting style.
  - You may return multiple blocks to replace one (e.g., expanding a paragraph into heading + paragraphs).

When operation is "insert":
  - Generate only the new blocks to be inserted.
  - Match the formatting style of surrounding blocks.
  - Do not repeat or modify existing blocks.

When operation is "append":
  - Generate only the new blocks to add at the end.
  - Continue the document's style and numbering conventions.

## CONTEXT YOU WILL RECEIVE

With each request you will receive:
  - "user_prompt": The user's instruction
  - "doc_outline": Array of {block_id, type, summary} for the full document (for edit ops)
  - "target_block_content": Full content of block being edited (for patch ops)
  - "selected_text": User-selected text (for selection-based edits)
  - "doc_format": Detected document format
  - "doc_default_style": Document-level font/size/spacing settings

Return ONLY the JSON. Nothing else.
`;


// SCHEMA VALIDATION HELPER
// Call this on LLM response before passing to executor

function validateLLMResponse(response) {
  const errors = [];

  if (!response.operation) {
    errors.push("Missing required field: operation");
  }

  const validOperations = ["create", "patch", "insert", "append"];
  if (!validOperations.includes(response.operation)) {
    errors.push(`Invalid operation: ${response.operation}`);
  }

  if (response.operation === "create") {
    if (!response.document) errors.push("Missing document object for create operation");
    if (!response.document?.blocks?.length) errors.push("Document must have at least one block");
  }

  if (response.operation === "patch") {
    if (!response.patch?.target_block_id) errors.push("Missing patch.target_block_id");
    if (!response.patch?.blocks?.length) errors.push("Patch must include replacement blocks");
  }

  if (response.operation === "insert") {
    if (!response.insert?.target_block_id) errors.push("Missing insert.target_block_id");
    if (!response.insert?.position) errors.push("Missing insert.position (before | after)");
    if (!response.insert?.blocks?.length) errors.push("Insert must include blocks to insert");
  }

  if (response.operation === "append") {
    if (!response.append?.blocks?.length) errors.push("Append must include blocks");
  }

  // Validate all blocks have unique block_ids
  const allBlocks = getAllBlocks(response);
  const ids = allBlocks.map(b => b.block_id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length) errors.push(`Duplicate block_ids found: ${duplicates.join(", ")}`);

  // Validate all blocks have valid types
  const validTypes = Object.keys(BLOCK_SCHEMAS);
  allBlocks.forEach(block => {
    if (!block.type) errors.push(`Block ${block.block_id} missing type`);
    if (!validTypes.includes(block.type)) errors.push(`Block ${block.block_id} has invalid type: ${block.type}`);
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

function getAllBlocks(response) {
  const blocks = [];
  const collect = (arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach(block => {
      blocks.push(block);
      // Recurse into columns_content
      if (block.type === "columns" && block.columns_content) {
        block.columns_content.forEach(col => collect(col.blocks));
      }
    });
  };

  if (response.operation === "create") collect(response.document?.blocks);
  if (response.operation === "patch") collect(response.patch?.blocks);
  if (response.operation === "insert") collect(response.insert?.blocks);
  if (response.operation === "append") collect(response.append?.blocks);

  return blocks;
}


// EXAMPLE — Full "create" response for a report

const EXAMPLE_RESPONSE = {
  operation: "create",
  document: {
    title: "Q3 Performance Report",
    format: "report",
    page_setup: {
      page_size: "LETTER",
      orientation: "portrait",
      margin_top_inches: 1,
      margin_bottom_inches: 1,
      margin_left_inches: 1,
      margin_right_inches: 1,
      columns: 1,
    },
    default_style: {
      font_family: "Arial",
      font_size_pt: 11,
      line_spacing: 1.15,
      text_color: "#000000",
      paragraph_spacing_after_pt: 10,
    },
    options: {
      include_table_of_contents: true,
      include_page_numbers: true,
      page_number_alignment: "CENTER",
      include_header: true,
      header_text: "Q3 Performance Report — Confidential",
      include_footer: false,
      footer_text: null,
    },
    blocks: [
      {
        block_id: "b1",
        type: "main_heading",
        content: "Q3 2025 Performance Report",
        font_size_pt: 28,
        font_color: "#1A1A2E",
        bold: true,
        italic: false,
        underline: false,
        alignment: "CENTER",
        spacing_before_pt: 0,
        spacing_after_pt: 6,
      },
      {
        block_id: "b2",
        type: "key_value",
        layout: "two_column",
        items: [
          { key: "Date", value: "October 1, 2025", key_bold: true },
          { key: "Author", value: "Analytics Team", key_bold: true },
          { key: "Department", value: "Business Intelligence", key_bold: true },
          { key: "Status", value: "Final", key_bold: true },
        ],
      },
      {
        block_id: "b3",
        type: "horizontal_rule",
        style: "solid",
        color: "#CCCCCC",
        thickness_pt: 1,
        spacing_before_pt: 12,
        spacing_after_pt: 12,
      },
      {
        block_id: "b4",
        type: "table_of_contents",
        title: "Table of Contents",
        include_levels: [1, 2],
        show_page_numbers: true,
      },
      {
        block_id: "b5",
        type: "sub_heading",
        level: "1",
        content: "Executive Summary",
        font_color: "#1A1A2E",
        bold: true,
        alignment: "LEFT",
        spacing_before_pt: 20,
        spacing_after_pt: 8,
      },
      {
        block_id: "b6",
        type: "callout",
        style: "info",
        title: "Key Takeaway",
        content: "Q3 2025 saw a 23% increase in revenue driven by strong enterprise sales and improved customer retention rates.",
        border_side: "left",
        icon: "📊",
      },
      {
        block_id: "b7",
        type: "paragraph",
        content: "This report provides a comprehensive analysis of business performance during Q3 2025, covering revenue, customer acquisition, and operational metrics. All figures are consolidated across regional offices.",
        alignment: "JUSTIFIED",
        spacing_after_pt: 10,
        inline_styles: [
          { start_index: 92, end_index: 101, bold: true }  // Bolds "Q3 2025,"
        ],
      },
      {
        block_id: "b8",
        type: "sub_heading",
        level: "1",
        content: "Performance Metrics",
        bold: true,
        alignment: "LEFT",
        spacing_before_pt: 20,
        spacing_after_pt: 8,
      },
      {
        block_id: "b9",
        type: "table",
        caption: "Table 1: Key Performance Indicators — Q3 2025 vs Q2 2025",
        has_header_row: true,
        has_header_column: false,
        border_color: "#CCCCCC",
        stripe_rows: true,
        stripe_color: "#F9F9F9",
        column_widths_percent: [40, 30, 30],
        header_style: {
          bg_color: "#1A1A2E",
          font_color: "#FFFFFF",
          bold: true,
          alignment: "CENTER",
        },
        cells: [
          [
            { content: "Metric", bold: true, alignment: "LEFT" },
            { content: "Q2 2025", bold: true, alignment: "CENTER" },
            { content: "Q3 2025", bold: true, alignment: "CENTER" },
          ],
          [
            { content: "Total Revenue", alignment: "LEFT" },
            { content: "$4.2M", alignment: "CENTER" },
            { content: "$5.17M", alignment: "CENTER", bold: true, font_color: "#27AE60" },
          ],
          [
            { content: "New Customers", alignment: "LEFT" },
            { content: "312", alignment: "CENTER" },
            { content: "401", alignment: "CENTER", bold: true, font_color: "#27AE60" },
          ],
          [
            { content: "Churn Rate", alignment: "LEFT" },
            { content: "4.1%", alignment: "CENTER" },
            { content: "3.2%", alignment: "CENTER", bold: true, font_color: "#27AE60" },
          ],
        ],
      },
    ],
  },
};


const BLOCK_ITEM_SCHEMA = {
  type: "object",
  oneOf: [
    {
      type: "object",
      properties: {
        block_id: { type: "string" },
        type: { type: "string", const: "main_heading" },
        content: { type: "string" },
        alignment: { type: "string", enum: ["LEFT", "CENTER", "RIGHT"] },
        font_size_pt: { type: "number" },
        font_color: { type: "string" },
        bold: { type: "boolean" }
      },
      required: ["block_id", "type", "content", "alignment", "font_size_pt", "font_color", "bold"],
      additionalProperties: false
    },
    {
      type: "object",
      properties: {
        block_id: { type: "string" },
        type: { type: "string", const: "sub_heading" },
        content: { type: "string" },
        level: { type: "integer", enum: [1, 2, 3] },
        alignment: { type: "string", enum: ["LEFT", "CENTER", "RIGHT"] },
        bold: { type: "boolean" }
      },
      required: ["block_id", "type", "content", "level", "alignment", "bold"],
      additionalProperties: false
    },
    {
      type: "object",
      properties: {
        block_id: { type: "string" },
        type: { type: "string", const: "paragraph" },
        content: { type: "string" },
        alignment: { type: "string", enum: ["LEFT", "CENTER", "RIGHT", "JUSTIFIED"] },
        italic: { type: "boolean" },
        bold: { type: "boolean" }
      },
      required: ["block_id", "type", "content", "alignment", "italic", "bold"],
      additionalProperties: false
    },
    {
      type: "object",
      properties: {
        block_id: { type: "string" },
        type: { type: "string", const: "table" },
        cells: {
          type: "array",
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                content: { type: "string" },
                bold: { type: "boolean" }
              },
              required: ["content", "bold"],
              additionalProperties: false
            }
          }
        }
      },
      required: ["block_id", "type", "cells"],
      additionalProperties: false
    },
    {
      type: "object",
      properties: {
        block_id: { type: "string" },
        type: { type: "string", const: "callout" },
        content: { type: "string" },
        style: { type: "string", enum: ["info", "warning", "success", "danger"] },
        title: { type: ["string", "null"] },
        icon: { type: ["string", "null"] }
      },
      required: ["block_id", "type", "content", "style", "title", "icon"],
      additionalProperties: false
    },
    {
      type: "object",
      properties: {
        block_id: { type: "string" },
        type: { type: "string", const: "bullet_list" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              content: { type: "string" },
              indent_level: { type: "integer" }
            },
            required: ["content", "indent_level"],
            additionalProperties: false
          }
        }
      },
      required: ["block_id", "type", "items"],
      additionalProperties: false
    },
    {
      type: "object",
      properties: {
        block_id: { type: "string" },
        type: { type: "string", const: "horizontal_rule" }
      },
      required: ["block_id", "type"],
      additionalProperties: false
    }
  ],
  additionalProperties: false
};

const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    operation: { type: "string", enum: ["create", "patch", "insert", "append"] },
    document: {
      anyOf: [
        {
          type: "object",
          properties: {
            title: { type: "string" },
            format: { type: "string", enum: ["article", "report", "essay", "thesis", "resume", "cover_letter", "proposal", "meeting_notes", "readme", "letter", "research_paper", "blog_post", "custom"] },
            page_setup: {
              type: "object",
              properties: {
                page_size: { type: "string", enum: ["A4", "LETTER"] },
                orientation: { type: "string", enum: ["portrait", "landscape"] },
                margin_top_inches: { type: "number" },
                margin_bottom_inches: { type: "number" },
                margin_left_inches: { type: "number" },
                margin_right_inches: { type: "number" },
                columns: { type: "integer" }
              },
              required: ["page_size", "orientation", "margin_top_inches", "margin_bottom_inches", "margin_left_inches", "margin_right_inches", "columns"],
              additionalProperties: false
            },
            default_style: {
              type: "object",
              properties: {
                font_family: { type: "string" },
                font_size_pt: { type: "number" },
                line_spacing: { type: "number" },
                text_color: { type: "string" },
                paragraph_spacing_after_pt: { type: "number" }
              },
              required: ["font_family", "font_size_pt", "line_spacing", "text_color", "paragraph_spacing_after_pt"],
              additionalProperties: false
            },
            options: {
              type: "object",
              properties: {
                include_table_of_contents: { type: "boolean" },
                include_page_numbers: { type: "boolean" },
                page_number_alignment: { type: "string", enum: ["LEFT", "CENTER", "RIGHT"] },
                include_header: { type: "boolean" },
                header_text: { type: ["string", "null"] },
                include_footer: { type: "boolean" },
                footer_text: { type: ["string", "null"] }
              },
              required: ["include_table_of_contents", "include_page_numbers", "page_number_alignment", "include_header", "header_text", "include_footer", "footer_text"],
              additionalProperties: false
            },
            blocks: {
              type: "array",
              items: {
                anyOf: [
                  {
                    type: "object",
                    properties: {
                      block_id: { type: "string" },
                      type: { type: "string", enum: ["main_heading", "sub_heading", "paragraph", "bullet_list", "numbered_list", "table", "callout", "code_block", "blockquote", "horizontal_rule", "page_break", "spacer", "key_value"] },
                      content: { type: "string" },
                      level: { type: "integer" },
                      font_size_pt: { type: "number" },
                      font_color: { type: "string" },
                      bold: { type: "boolean" },
                      italic: { type: "boolean" },
                      alignment: { type: "string", enum: ["LEFT", "CENTER", "RIGHT", "JUSTIFIED"] }
                    },
                    required: ["block_id", "type", "content", "level", "font_size_pt", "font_color", "bold", "italic", "alignment"],
                    additionalProperties: false
                  },
                  {
                    type: "object",
                    properties: {
                      block_id: { type: "string" },
                      type: { type: "string", enum: ["table"] },
                      cells: {
                        type: "array",
                        items: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              content: { type: "string" },
                              bold: { type: "boolean" }
                            },
                            required: ["content", "bold"],
                            additionalProperties: false
                          }
                        }
                      }
                    },
                    required: ["block_id", "type", "cells"],
                    additionalProperties: false
                  },
                  {
                    type: "object",
                    properties: {
                      block_id: { type: "string" },
                      type: { type: "string", enum: ["bullet_list", "numbered_list"] },
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            content: { type: "string" },
                            indent_level: { type: "integer" }
                          },
                          required: ["content", "indent_level"],
                          additionalProperties: false
                        }
                      }
                    },
                    required: ["block_id", "type", "items"],
                    additionalProperties: false
                  },
                  {
                    type: "object",
                    properties: {
                      block_id: { type: "string" },
                      type: { type: "string", enum: ["callout"] },
                      content: { type: "string" },
                      style: { type: "string", enum: ["info", "warning", "success", "danger"] },
                      title: { type: "string" },
                      icon: { type: "string" }
                    },
                    required: ["block_id", "type", "content", "style", "title", "icon"],
                    additionalProperties: false
                  }
                ]
              }
            }
          },
          required: ["title", "format", "page_setup", "default_style", "options", "blocks"],
          additionalProperties: false
        },
        { type: "null" }
      ]
    },
    patch: {
      anyOf: [
        {
          type: "object",
          properties: {
            target_block_id: { type: "string" },
            action: { type: "string", enum: ["replace", "expand", "summarize", "rewrite"] }
            // Note: intentionally omitting blocks here to simplify schema for token limits
          },
          required: ["target_block_id", "action"],
          additionalProperties: false
        },
        { type: "null" }
      ]
    },
    insert: {
      anyOf: [
        {
          type: "object",
          properties: {
            target_block_id: { type: "string" },
            position: { type: "string", enum: ["before", "after"] }
          },
          required: ["target_block_id", "position"],
          additionalProperties: false
        },
        { type: "null" }
      ]
    },
    append: {
      anyOf: [
        {
          type: "object",
          properties: {
            // simplified
            status: { type: "string" }
          },
          required: ["status"],
          additionalProperties: false
        },
        { type: "null" }
      ]
    }
  },
  required: ["operation", "document", "patch", "insert", "append"],
  additionalProperties: false
};

const getJsonSchemaForType = (type) => {
  // Clone the base schema
  const schema = JSON.parse(JSON.stringify(RESPONSE_JSON_SCHEMA));

  // Basic doc type identifier constraint
  if (type !== 'general') {
    // Specifically fix the format to the selected type
    // This helps the LLM align with the user's intent
    const docProps = schema.properties.document.anyOf[0].properties;

    // Most types match their enum value
    let formatValue = type;
    if (type === 'technical_docs') formatValue = 'report'; // fallback for logic or use custom

    // We use enum with a single value for compatibility with some strict modes
    docProps.format = { type: "string", enum: [formatValue] };
  }

  // Specialized structural adjustments
  switch (type) {
    case 'report':
    case 'research_paper':
      schema.properties.document.anyOf[0].properties.options.properties.include_table_of_contents = { type: "boolean", enum: [true] };
      break;
    case 'thesis':
      schema.properties.document.anyOf[0].properties.page_setup.properties.page_size = { type: "string", enum: ["A4"] };
      schema.properties.document.anyOf[0].properties.options.properties.include_page_numbers = { type: "boolean", enum: [true] };
      break;
    case 'resume':
      schema.properties.document.anyOf[0].properties.options.properties.include_table_of_contents = { type: "boolean", enum: [false] };
      break;
  }

  return schema;
};

module.exports = {
  RESPONSE_SCHEMA,
  BLOCK_SCHEMAS,
  SYSTEM_PROMPT_INSTRUCTIONS,
  EXAMPLE_RESPONSE,
  RESPONSE_JSON_SCHEMA,
  validateLLMResponse,
  getAllBlocks,
  getJsonSchemaForType
};