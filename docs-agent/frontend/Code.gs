/**
 * @OnlyCurrentDoc
 */

const BACKEND_URL = 'https://lawana-nucleoloid-leland.ngrok-free.dev/generate';
const SECTION_URL = 'https://lawana-nucleoloid-leland.ngrok-free.dev/section';

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
 * Returns either the final message (single-shot), job metadata (iterative), or handles immediate editing.
 */
function processPrompt(prompt, docType, operationMode = 'create') {
    try {
        const docId = DocumentApp.getActiveDocument().getId();
        const userEmail = Session.getEffectiveUser().getEmail();

        const options = {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify({
                prompt: prompt,
                docType: docType || 'general',
                docId: docId,
                email: userEmail,
                operationMode: operationMode
            }),
            muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(BACKEND_URL, options);
        const data = JSON.parse(response.getContentText());

        console.log('--- BACKEND RESPONSE RECEIVED ---');
        console.log('Mode:', data.mode || (data.jobId ? 'iterative_start' : (data.operation || 'single-shot')));
        console.log('---------------------------------');

        // Handle structural error
        if (data.error) {
            throw new Error(data.error);
        }

        // ── Edit Mode ──
        if (operationMode === 'edit') {
            if (!data.target_section_id || !data.blocks) {
                throw new Error("AI returned invalid replacement data.");
            }
            replaceSectionBlocks(data.target_section_id, data.blocks);
            return { message: "✅ Section updated successfully!", status: "complete" };
        }

        // ── Iterative mode start (long-form docs) ──
        if (data.mode === 'iterative_start' || data.jobId) {
            // Document setup (title, etc.) happens once at the start
            setupDocument(data.document);
            return data; // Return full metadata to UI to handle the loop
        }

        // ── Single-shot mode (short-form docs) ──
        if (data.operation) {
            executeOperation(data);
            return { message: "✅ Document created successfully!", status: "complete" };
        }

    } catch (error) {
        return { message: "❌ Error: " + error.toString(), status: "error" };
    }
}

/**
 * Clears the chat history for the current document on the backend.
 */
function clearChat() {
    try {
        const docId = DocumentApp.getActiveDocument().getId();
        const userEmail = Session.getEffectiveUser().getEmail();

        const url = `https://lawana-nucleoloid-leland.ngrok-free.dev/chat/${docId}`;
        const options = {
            method: 'delete',
            contentType: 'application/json',
            payload: JSON.stringify({ email: userEmail }),
            muteHttpExceptions: true
        };
        const response = UrlFetchApp.fetch(url, options);
        const data = JSON.parse(response.getContentText());
        return data.status === 'success' ? "🧹 Memory cleared for this document." : "❌ Failed to clear memory.";
    } catch (error) {
        return "❌ Error clearing memory: " + error.toString();
    }
}

/**
 * Sets up document metadata (title, page setup).
 */
function setupDocument(docMetadata) {
    if (!docMetadata) return;
    const doc = DocumentApp.getActiveDocument();
    const body = doc.getBody();

    if (docMetadata.title) doc.setName(docMetadata.title);
    applyPageSetup(body, docMetadata.page_setup);

    doc.saveAndClose();
}

/**
 * Fetches and renders a single section from the backend.
 * Called iteratively from the sidebar UI.
 */
function fetchAndRenderSection(jobId, index) {
    try {
        const url = `${SECTION_URL}/${jobId}/${index}`;
        const options = {
            method: 'get',
            headers: {
                'ngrok-skip-browser-warning': 'true'
            },
            muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(url, options);
        let data;
        try {
            data = JSON.parse(response.getContentText());
        } catch (e) {
            throw new Error(`Failed to parse backend response for section ${index}. Content: ` + response.getContentText().substring(0, 50));
        }

        if (data.error) {
            throw new Error(data.error);
        }

        if (data.blocks && data.blocks.length > 0) {
            const doc = DocumentApp.getActiveDocument();
            const body = doc.getBody();
            const addedElements = renderBlocks(body, data.blocks);

            // Phase 2: Create a NamedRange spanning the new section elements
            if (data.section_id && addedElements.length > 0) {
                const rangeBuilder = doc.newRange();
                rangeBuilder.addElementsBetween(addedElements[0], addedElements[addedElements.length - 1]);
                doc.addNamedRange(data.section_id, rangeBuilder.build());
            }

            doc.saveAndClose();
        }

        return { status: "success", title: data.title };
    } catch (error) {
        throw new Error(`Failed to render section ${index}: ` + error.toString());
    }
}

/**
 * Targeted Replacement for Section Edit Mode.
 * Locates the exact section by its NamedRange ID, deletes it, and inserts new blocks perfectly in place.
 */
function replaceSectionBlocks(section_id, blocks) {
    if (!blocks || blocks.length === 0) return;

    const doc = DocumentApp.getActiveDocument();
    const body = doc.getBody();
    const namedRanges = doc.getNamedRanges();
    const targetRange = namedRanges.find(nr => nr.getName() === section_id);

    if (!targetRange) {
        throw new Error(`Could not find section '${section_id}' in the document. It may have been deleted.`);
    }

    const range = targetRange.getRange();
    const elements = range.getRangeElements();

    if (elements.length === 0) {
        throw new Error("Target section is empty.");
    }

    // Attempt to locate the parent and the insertion index
    let parent = null;
    let insertIndex = -1;

    // Find the first valid element with a parent to determine our insertion point.
    for (let re of elements) {
        const el = re.getElement();
        parent = el.getParent();
        if (parent === body) {
            insertIndex = body.getChildIndex(el);
            break;
        } else if (parent && parent.getParent() === body) {
            parent = parent.getParent();
            insertIndex = body.getChildIndex(parent);
            break;
        }
    }

    if (insertIndex === -1) {
        throw new Error("Could not determine where to insert the updated section.");
    }

    // Safely remove the old elements
    elements.reverse().forEach(re => {
        try {
            const el = re.getElement();
            if (el.getParent()) {
                if (el.isPartial()) {
                    // For partials, it's safer to remove the whole element if we're replacing the section
                    el.removeFromParent();
                } else {
                    el.removeFromParent();
                }
            }
        } catch (e) { } // Ignore removals that fail (e.g., child of already removed parent)
    });

    targetRange.remove();

    // Insert new elements at the exact cleared position
    const addedElements = renderBlocks(body, blocks, insertIndex);

    if (addedElements.length > 0) {
        const rangeBuilder = doc.newRange();
        rangeBuilder.addElementsBetween(addedElements[0], addedElements[addedElements.length - 1]);
        doc.addNamedRange(section_id, rangeBuilder.build());
    }

    doc.saveAndClose();
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
 * Returns the array of appended Element objects for NamedRange tracking.
 */
function renderBlocks(body, blocks, insertIndex = -1) {
    if (!blocks || !Array.isArray(blocks)) return [];

    const addedElements = [];
    let currentIndex = insertIndex;

    const getElement = (methodInsert, methodAppend, ...args) => {
        if (currentIndex > -1) {
            const el = methodInsert.apply(body, [currentIndex, ...args]);
            currentIndex++;
            return el;
        } else {
            return methodAppend.apply(body, args);
        }
    };

    blocks.forEach(block => {
        console.log('Rendering block: ' + block.type + ' (ID: ' + block.block_id + ')');

        // Handle common LLM property name hallucinations
        const content = block.content || block.text || "";
        const alignment = block.alignment || block.align || "";
        const bgColor = block.bg_color || block.background_color || null;

        switch (block.type) {
            case 'main_heading':
                const title = getElement(body.insertParagraph, body.appendParagraph, content);
                title.setHeading(DocumentApp.ParagraphHeading.TITLE);
                applyBlockStyles(title, block);
                addedElements.push(title);
                break;

            case 'sub_heading':
                const hLevel = block.level === 1 ? DocumentApp.ParagraphHeading.HEADING1 :
                    block.level === 2 ? DocumentApp.ParagraphHeading.HEADING2 :
                        DocumentApp.ParagraphHeading.HEADING3;
                const sub = getElement(body.insertParagraph, body.appendParagraph, content);
                sub.setHeading(hLevel);
                applyBlockStyles(sub, block);
                addedElements.push(sub);
                break;

            case 'paragraph':
                const p = getElement(body.insertParagraph, body.appendParagraph, content);
                applyBlockStyles(p, block);
                applyInlineStyles(p, block.inline_styles);
                addedElements.push(p);
                break;

            case 'bullet_list':
                if (block.items) {
                    block.items.forEach(item => {
                        const li = getElement(body.insertListItem, body.appendListItem, item.content || item.text);
                        li.setGlyphType(DocumentApp.GlyphType.BULLET)
                            .setNestingLevel(item.indent_level || item.nesting || 0);
                        applyBlockStyles(li, item);
                        addedElements.push(li);
                    });
                }
                break;

            case 'numbered_list':
                if (block.items) {
                    block.items.forEach(item => {
                        const li = getElement(body.insertListItem, body.appendListItem, item.content || item.text);
                        li.setGlyphType(DocumentApp.GlyphType.NUMBER)
                            .setNestingLevel(item.indent_level || item.nesting || 0);
                        applyBlockStyles(li, item);
                        addedElements.push(li);
                    });
                }
                break;

            case 'code_block':
                const code = getElement(body.insertParagraph, body.appendParagraph, content);
                const codeStyle = {};
                codeStyle[DocumentApp.Attribute.FONT_FAMILY] = block.font_family || 'Courier New';
                codeStyle[DocumentApp.Attribute.BACKGROUND_COLOR] = bgColor || '#F5F5F5';
                codeStyle[DocumentApp.Attribute.FONT_SIZE] = block.font_size_pt || 10;
                code.setAttributes(codeStyle);
                addedElements.push(code);
                break;

            case 'table':
                let tableData = [];
                const rawCells = block.cells || block.content || block.rows;

                if (Array.isArray(rawCells)) {
                    // Extract strings and handle object parsing
                    tableData = rawCells.map((row) => {
                        if (Array.isArray(row)) {
                            return row.map((cell) => {
                                if (cell === null || cell === undefined) return "";
                                return typeof cell === 'object' ? (cell.content || cell.text || "") : cell.toString();
                            });
                        }
                        return [row ? row.toString() : ""];
                    });

                    // Google Docs appendTable REQUIRES a perfectly rectangular 2D array.
                    // If the LLM generated jagged rows, it crashes with "Invalid argument: cells[x][y]"
                    if (tableData.length > 0) {
                        const maxCols = Math.max(...tableData.map(row => row.length));
                        tableData = tableData.map(row => {
                            const paddedRow = [...row];
                            while (paddedRow.length < maxCols) {
                                paddedRow.push("");
                            }
                            return paddedRow;
                        });
                    }
                }

                if (tableData.length > 0 && tableData[0].length > 0) {
                    try {
                        const table = getElement(body.insertTable, body.appendTable, tableData);
                        if (alignment === 'CENTER') table.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
                        addedElements.push(table);
                    } catch (e) {
                        console.error("Failed to append table data:", e, tableData);
                    }
                }
                break;

            case 'horizontal_rule':
                const hr = getElement(body.insertHorizontalRule, body.appendHorizontalRule);
                addedElements.push(hr);
                break;

            case 'page_break':
                const pb = getElement(body.insertPageBreak, body.appendPageBreak);
                addedElements.push(pb);
                break;

            case 'blockquote':
                const bq = getElement(body.insertParagraph, body.appendParagraph, content);
                bq.setIndentLeft(block.indent_left_inches ? block.indent_left_inches * 72 : 36);
                bq.setItalic(true);
                addedElements.push(bq);
                if (block.attribution) {
                    const attr = getElement(body.insertParagraph, body.appendParagraph, block.attribution);
                    attr.setIndentLeft(bq.getIndentLeft()).setItalic(true);
                    addedElements.push(attr);
                }
                break;

            case 'callout':
                const coText = (block.icon ? block.icon + " " : "") + (block.title ? block.title + "\n" : "") + content;
                const co = getElement(body.insertParagraph, body.appendParagraph, coText);
                const coStyle = {};
                coStyle[DocumentApp.Attribute.BACKGROUND_COLOR] = bgColor || (block.style === 'success' ? '#E8F5E9' : '#FFF9C4');
                if (block.font_color === '#FFFFFF') coStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#FFFFFF';
                co.setAttributes(coStyle);
                if (alignment === 'CENTER') co.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
                addedElements.push(co);
                break;

            case 'key_value':
                if (block.items) {
                    block.items.forEach(item => {
                        const kvText = (item.key_bold ? '' : '') + item.key + ': ' + item.value;
                        const kv = getElement(body.insertParagraph, body.appendParagraph, kvText);
                        kv.editAsText().setBold(0, item.key.length, true);
                        addedElements.push(kv);
                    });
                }
                break;
        }
    });

    return addedElements;
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
