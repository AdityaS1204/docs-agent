/**
 * ITERATIVE GENERATION SCHEMAS
 * =============================
 * Used for long-form documents (reports, thesis, research papers, etc.)
 * Phase 1: Generate an outline (1 LLM call)
 * Phase 2: Generate each section (1 LLM call per section)
 */

// ──────────────────────────────────────────
// PHASE 1: OUTLINE SCHEMA
// LLM returns a structured document plan.
// ──────────────────────────────────────────
const OUTLINE_SCHEMA = {
    type: "object",
    properties: {
        title: { type: "string" },
        format: {
            type: "string",
            enum: [
                "report", "article", "thesis", "research_paper",
                "proposal", "meeting_notes", "legal",
                "technical_docs", "case_study", "white_paper",
                "policy", "general"
            ]
        },
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
        sections: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    section_id: { type: "string" },
                    title: { type: "string" },
                    type: {
                        type: "string",
                        enum: ["intro", "body", "conclusion", "appendix", "abstract", "references"]
                    },
                    depth: { type: "integer", enum: [1, 2, 3] },
                    description: { type: "string" }
                },
                required: ["section_id", "title", "type", "depth", "description"],
                additionalProperties: false
            }
        }
    },
    required: ["title", "format", "page_setup", "default_style", "options", "sections"],
    additionalProperties: false
};


// ──────────────────────────────────────────
// PHASE 2: SECTION SCHEMA
// LLM returns content blocks for one section.
// This is the same block system, just scoped to one section at a time.
// ──────────────────────────────────────────
const SECTION_BLOCK_SCHEMA = {
    anyOf: [
        {
            type: "object",
            properties: {
                block_id: { type: "string" },
                type: {
                    type: "string",
                    enum: ["main_heading", "sub_heading", "paragraph", "bullet_list",
                        "numbered_list", "callout", "code_block", "blockquote",
                        "horizontal_rule", "page_break", "key_value"]
                },
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
        }
    ]
};

const SECTION_SCHEMA = {
    type: "object",
    properties: {
        section_id: { type: "string" },
        blocks: {
            type: "array",
            items: SECTION_BLOCK_SCHEMA
        }
    },
    required: ["section_id", "blocks"],
    additionalProperties: false
};


// ──────────────────────────────────────────
// Which doc types use iterative mode
// Resume and cover letters are excluded (short-form)
// ──────────────────────────────────────────
const ITERATIVE_DOC_TYPES = new Set([
    "report",
    "article",
    "thesis",
    "research_paper",
    "proposal",
    "meeting_notes",
    "legal",
    "technical_docs",
    "case_study",
    "white_paper",
    "policy"
]);

function isIterativeType(docType) {
    return ITERATIVE_DOC_TYPES.has(docType);
}

module.exports = {
    OUTLINE_SCHEMA,
    SECTION_SCHEMA,
    isIterativeType
};
