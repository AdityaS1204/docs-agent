/**
 * @OnlyCurrentDoc
 */

const BACKEND_URL = 'https://lawana-nucleoloid-leland.ngrok-free.dev/generate';

function onOpen() {
    DocumentApp.getUi()
        .createMenu('AI Assistant')
        .addItem('Open Sidebar', 'showSidebar')
        .addToUi();
}

function showSidebar() {
    const html = HtmlService.createTemplateFromFile('index')
        .evaluate()
        .setTitle('AI Docs Assistant')
        .setWidth(300);

    DocumentApp.getUi().showSidebar(html);
}

/**
 * Main entry point called from the sidebar.
 * Returns a status/message string for the chat bubble.
 */
function processPrompt(prompt, docType) {
    try {
        const options = {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify({
                prompt: prompt,
                docType: docType || 'general'
            }),
            muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(BACKEND_URL, options);
        const data = JSON.parse(response.getContentText());

        console.log('--- BACKEND RESPONSE RECEIVED ---');
        console.log('Mode:', data.mode || 'single-shot');
        console.log('---------------------------------');

        // ── Iterative mode (long-form docs) ──
        if (data.mode === 'iterative' && data.sections) {
            return handleIterativeResponse(data);
        }

        // ── Single-shot mode (short-form docs) ──
        if (data.operation) {
            executeOperation(data);
            return "✅ Document created successfully!";
        }

        return data.display_message || "Done processing.";

    } catch (error) {
        return "❌ Error: " + error.toString();
    }
}

/**
 * Handles the iterative response by rendering the document
 * section by section with real-time progress reporting.
 */
function handleIterativeResponse(data) {
    const doc = DocumentApp.getActiveDocument();
    const body = doc.getBody();

    // Set document title and page setup first
    if (data.document) {
        if (data.document.title) doc.setName(data.document.title);
        applyPageSetup(body, data.document.page_setup);
    }

    const totalSections = data.sections.length;
    let renderedCount = 0;

    // Render each section's blocks
    for (const section of data.sections) {
        if (section.blocks && section.blocks.length > 0) {
            renderBlocks(body, section.blocks);
        }
        renderedCount++;
        console.log(`Rendered section ${renderedCount}/${totalSections}: ${section.title}`);
    }

    doc.saveAndClose();
    return `✅ Document complete! Generated ${totalSections} sections with full content.`;
}

/**
 * Top-level executor for single-shot RESPONSE_SCHEMA operations.
 */
function executeOperation(response) {
    const doc = DocumentApp.getActiveDocument();
    const body = doc.getBody();

    switch (response.operation) {
        case 'create':
            if (response.document) {
                if (response.document.title) {
                    doc.setName(response.document.title);
                }
                applyPageSetup(body, response.document.page_setup);
                renderBlocks(body, response.document.blocks);
            }
            break;

        case 'append':
            if (response.append && response.append.blocks) {
                renderBlocks(body, response.append.blocks);
            }
            break;

        case 'patch':
            if (response.patch && response.patch.blocks) {
                renderBlocks(body, response.patch.blocks);
            }
            break;

        case 'insert':
            if (response.insert && response.insert.blocks) {
                renderBlocks(body, response.insert.blocks);
            }
            break;
    }

    doc.saveAndClose();
}

/**
 * Applies Document-level page setup.
 */
function applyPageSetup(body, setup) {
    if (!setup) return;
    if (setup.margin_top_inches) body.setMarginTop(setup.margin_top_inches * 72);
    if (setup.margin_bottom_inches) body.setMarginBottom(setup.margin_bottom_inches * 72);
    if (setup.margin_left_inches) body.setMarginLeft(setup.margin_left_inches * 72);
    if (setup.margin_right_inches) body.setMarginRight(setup.margin_right_inches * 72);
}

/**
 * Iterates through blocks and renders them to the document body.
 */
function renderBlocks(body, blocks) {
    if (!blocks || !Array.isArray(blocks)) return;

    blocks.forEach(block => {
        console.log('Rendering block: ' + block.type + ' (ID: ' + block.block_id + ')');

        // Handle common LLM property name hallucinations
        const content = block.content || block.text || "";
        const alignment = block.alignment || block.align || "";
        const bgColor = block.bg_color || block.background_color || null;

        switch (block.type) {
            case 'main_heading':
                const title = body.appendParagraph(content).setHeading(DocumentApp.ParagraphHeading.TITLE);
                applyBlockStyles(title, block);
                break;

            case 'sub_heading':
                const hLevel = block.level === 1 ? DocumentApp.ParagraphHeading.HEADING1 :
                    block.level === 2 ? DocumentApp.ParagraphHeading.HEADING2 :
                        DocumentApp.ParagraphHeading.HEADING3;
                const sub = body.appendParagraph(content).setHeading(hLevel);
                applyBlockStyles(sub, block);
                break;

            case 'paragraph':
                const p = body.appendParagraph(content);
                applyBlockStyles(p, block);
                applyInlineStyles(p, block.inline_styles);
                break;

            case 'bullet_list':
                if (block.items) {
                    block.items.forEach(item => {
                        const li = body.appendListItem(item.content || item.text)
                            .setGlyphType(DocumentApp.GlyphType.BULLET)
                            .setNestingLevel(item.indent_level || item.nesting || 0);
                        applyBlockStyles(li, item);
                    });
                }
                break;

            case 'numbered_list':
                if (block.items) {
                    block.items.forEach(item => {
                        const li = body.appendListItem(item.content || item.text)
                            .setGlyphType(DocumentApp.GlyphType.NUMBER)
                            .setNestingLevel(item.indent_level || item.nesting || 0);
                        applyBlockStyles(li, item);
                    });
                }
                break;

            case 'code_block':
                const code = body.appendParagraph(content);
                const codeStyle = {};
                codeStyle[DocumentApp.Attribute.FONT_FAMILY] = block.font_family || 'Courier New';
                codeStyle[DocumentApp.Attribute.BACKGROUND_COLOR] = bgColor || '#F5F5F5';
                codeStyle[DocumentApp.Attribute.FONT_SIZE] = block.font_size_pt || 10;
                code.setAttributes(codeStyle);
                break;

            case 'table':
                let tableData = [];
                const rawCells = block.cells || block.content || block.rows;

                if (Array.isArray(rawCells)) {
                    tableData = rawCells.map(row => {
                        if (Array.isArray(row)) {
                            return row.map(cell => (typeof cell === 'object' ? cell.content : cell));
                        }
                        return [row.toString()];
                    });
                }

                if (tableData.length > 0) {
                    const table = body.appendTable(tableData);
                    if (alignment === 'CENTER') table.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
                }
                break;

            case 'horizontal_rule':
                body.appendHorizontalRule();
                break;

            case 'page_break':
                body.appendPageBreak();
                break;

            case 'blockquote':
                const bq = body.appendParagraph(content);
                bq.setIndentLeft(block.indent_left_inches ? block.indent_left_inches * 72 : 36);
                bq.setItalic(true);
                if (block.attribution) {
                    body.appendParagraph(block.attribution).setIndentLeft(bq.getIndentLeft()).setItalic(true);
                }
                break;

            case 'callout':
                const coText = (block.icon ? block.icon + " " : "") + (block.title ? block.title + "\n" : "") + content;
                const co = body.appendParagraph(coText);
                const coStyle = {};
                coStyle[DocumentApp.Attribute.BACKGROUND_COLOR] = bgColor || (block.style === 'success' ? '#E8F5E9' : '#FFF9C4');
                if (block.font_color === '#FFFFFF') coStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#FFFFFF';
                co.setAttributes(coStyle);
                if (alignment === 'CENTER') co.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
                break;

            case 'key_value':
                if (block.items) {
                    block.items.forEach(item => {
                        const kvText = (item.key_bold ? '' : '') + item.key + ': ' + item.value;
                        const kv = body.appendParagraph(kvText);
                        kv.editAsText().setBold(0, item.key.length, true);
                    });
                }
                break;
        }
    });
}

/**
 * Applies basic styles (bold, italic, color, alignment) to a paragraph or list item.
 */
function applyBlockStyles(element, styles) {
    if (!element || !styles) return;

    const bold = styles.bold !== undefined ? styles.bold : false;
    const italic = styles.italic !== undefined ? styles.italic : false;
    const underline = styles.underline !== undefined ? styles.underline : false;
    const alignment = styles.alignment || styles.align;
    const fontSize = styles.font_size_pt || styles.fontSize;

    element.setBold(bold);
    element.setItalic(italic);
    element.setUnderline(underline);

    if (styles.font_color && styles.font_color !== 'default') {
        element.setForegroundColor(styles.font_color);
    } else if (styles.color) {
        element.setForegroundColor(styles.color);
    }

    if (alignment) {
        const align = alignment === 'CENTER' ? DocumentApp.HorizontalAlignment.CENTER :
            alignment === 'RIGHT' ? DocumentApp.HorizontalAlignment.RIGHT :
                alignment === 'JUSTIFIED' ? DocumentApp.HorizontalAlignment.JUSTIFIED :
                    DocumentApp.HorizontalAlignment.LEFT;
        element.setAlignment(align);
    }

    if (fontSize) element.setFontSize(fontSize);
    if (styles.font_family) element.setFontFamily(styles.font_family);
}

/**
 * Applies inline ranges of styles within a paragraph.
 */
function applyInlineStyles(paragraph, inlineStyles) {
    if (!inlineStyles || !Array.isArray(inlineStyles)) return;

    const text = paragraph.editAsText();
    inlineStyles.forEach(style => {
        if (style.start_index === undefined || style.end_index === undefined) return;

        const len = text.getText().length;
        const start = Math.max(0, Math.min(style.start_index, len - 1));
        const end = Math.max(0, Math.min(style.end_index, len - 1));

        if (style.bold !== undefined) text.setBold(start, end, style.bold);
        if (style.italic !== undefined) text.setItalic(start, end, style.italic);
        if (style.underline !== undefined) text.setUnderline(start, end, style.underline);
        if (style.font_color) text.setForegroundColor(start, end, style.font_color);
        if (style.highlight_color) text.setBackgroundColor(start, end, style.highlight_color);
        if (style.font_size_pt) text.setFontSize(start, end, style.font_size_pt);
        if (style.link_url) text.setLinkUrl(start, end, style.link_url);
    });
}
