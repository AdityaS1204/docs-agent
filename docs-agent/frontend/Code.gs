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
function processPrompt(payload) {
    try {
        const { prompt, format, operation, block_id, selected_text } = payload;
        const docId = DocumentApp.getActiveDocument().getId();
        const userEmail = Session.getEffectiveUser().getEmail();
        const operationMode = operation || 'create';

        let targetUrl = BACKEND_URL;
        let finalPayload = {
            prompt: prompt,
            docType: format || 'general',
            docId: docId,
            email: userEmail,
            operationMode: operationMode
        };

        // If we have a specific block_id and we are in edit mode, use the surgical endpoint
        if (operationMode === 'edit' && block_id) {
            targetUrl = BACKEND_URL.replace('/generate', '/edit-section');

            // Get LIVE content from doc for context
            let liveContent = "";
            try {
                const liveData = getSectionContent(block_id);
                liveContent = liveData.content;
            } catch (e) {
                console.warn("Could not fetch live content for section:", block_id);
            }

            finalPayload = {
                doc_id: docId,
                block_id: block_id,
                instruction: prompt,
                current_content: liveContent,
                doc_type: format || 'report',
                email: userEmail
            };
        }

        const options = {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify(finalPayload),
            muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(targetUrl, options);
        const data = JSON.parse(response.getContentText());

        console.log('--- BACKEND RESPONSE RECEIVED ---');
        console.log('Target:', targetUrl);
        console.log('---------------------------------');

        // Handle structural error
        if (data.error) {
            throw new Error(data.message || data.error);
        }

        // ── Edit Mode (Surgical or Legacy) ──
        if (operationMode === 'edit') {
            const targetId = data.target_section_id || block_id;
            if (!targetId || !data.blocks) {
                throw new Error("AI returned invalid replacement data.");
            }
            // Use markers if available, fallback to NamedRange logic if markers missing
            const markerCheck = checkMarkersIntact(data.target_section_id);
            if (markerCheck.intact) {
                replaceSectionByMarkers(data.target_section_id, data.blocks);
            } else {
                replaceSectionBlocks(data.target_section_id, data.blocks); // Legacy fallback
            }
            return { message: "Section updated successfully!", status: "complete" };
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
            return { message: "Document created successfully!", status: "complete" };
        }

    } catch (error) {
        return { message: "Error: " + error.toString(), status: "error" };
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
        return data.status === 'success' ? "Memory cleared for this document." : "Failed to clear memory.";
    } catch (error) {
        return "Error clearing memory: " + error.toString();
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

            // 1. Insert Start Marker
            const startMarker = body.appendParagraph(`[§${data.section_id}§]`);
            applyMarkerStyle(startMarker);

            // 2. Render Blocks
            const addedElements = renderBlocks(body, data.blocks);

            // 3. Insert End Marker
            const endMarker = body.appendParagraph(`[§/${data.section_id}§]`);
            applyMarkerStyle(endMarker);

            // Phase 2: Create a NamedRange (Legacy fallback/UX)
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

    let insertIndex = -1;
    const elementsToDelete = [];

    // 1. Snapshot the elements we intend to delete and find the insertion point
    for (let re of elements) {
        let el = re.getElement();
        // Traverse up to find the direct child of the body
        let topChild = el;
        while (topChild && topChild.getParent() && topChild.getParent().getType() !== DocumentApp.ElementType.BODY_SECTION) {
            topChild = topChild.getParent();
        }

        if (topChild && topChild.getParent() && topChild.getParent().getType() === DocumentApp.ElementType.BODY_SECTION) {
            if (insertIndex === -1) {
                insertIndex = body.getChildIndex(topChild);
            }
            if (!elementsToDelete.includes(topChild)) {
                elementsToDelete.push(topChild);
            }
        }
    }

    if (insertIndex === -1) {
        insertIndex = body.getNumChildren();
    }

    // 2. Insert a temporary marker to anchor our position
    const marker = body.insertParagraph(insertIndex, "--- [TEMP MARKER] ---");
    const actualInsertIndex = body.getChildIndex(marker) + 1;

    // 3. Render the new blocks after the marker
    const addedElements = renderBlocks(body, blocks, actualInsertIndex);

    // 4. Safely remove the snapshotized old elements
    // We only remove top-level children of the body to avoid hierarchy issues
    elementsToDelete.reverse().forEach(el => {
        try {
            // Protect main heading from being deleted if it's the only element
            if (el.getType() === DocumentApp.ElementType.PARAGRAPH && el.asParagraph().getHeading() === DocumentApp.ParagraphHeading.TITLE) {
                // If it's a main heading, don't delete it, just clear its content
                el.asParagraph().setText("");
            } else if (el.getParent() && body.getNumChildren() > 1) {
                // NEVER remove the only remaining paragraph in the doc
                el.removeFromParent();
            }
        } catch (e) {
            console.error("Failed to remove element during swap:", e);
        }
    });

    // 5. Cleanup: remove the marker and the old range
    if (body.getNumChildren() > 1) {
        marker.removeFromParent();
    } else {
        // If the marker IS the only thing left, we clear its text and leave it as an empty line
        marker.setText("");
    }

    targetRange.remove();

    // 6. Create the new range
    if (addedElements.length > 0) {
        const rangeBuilder = doc.newRange();
        // Specifically only include the elements we just rendered
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
                applyBlockStyles(bq, block); // Always apply styles
                addedElements.push(bq);
                if (block.attribution) {
                    const attr = getElement(body.insertParagraph, body.appendParagraph, block.attribution);
                    attr.setIndentLeft(bq.getIndentLeft()).setItalic(true);
                    applyBlockStyles(attr, block); // Use same block parent styles if any
                    addedElements.push(attr);
                }
                break;

            case 'callout':
                const coText = (block.icon ? block.icon + " " : "") + (block.title ? block.title + "\n" : "") + content;
                const co = getElement(body.insertParagraph, body.appendParagraph, coText);
                applyBlockStyles(co, block); // Always apply styles first for reset
                const coStyle = {};
                coStyle[DocumentApp.Attribute.BACKGROUND_COLOR] = bgColor || (block.style === 'success' ? '#E8F5E9' : '#FFF9C4');
                if (block.font_color === '#FFFFFF') coStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#FFFFFF';
                co.setAttributes(coStyle);
                addedElements.push(co);
                break;

            case 'key_value':
                if (block.items) {
                    block.items.forEach(item => {
                        const kvText = item.key + ': ' + item.value;
                        const kv = getElement(body.insertParagraph, body.appendParagraph, kvText);
                        applyBlockStyles(kv, block); // Use parent block styles for reset
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

    // Only override bold/italic/underline if explicitly defined in the block data
    if (styles.bold !== undefined) element.setBold(styles.bold);
    if (styles.italic !== undefined) element.setItalic(styles.italic);
    if (styles.underline !== undefined) element.setUnderline(styles.underline);

    const alignment = styles.alignment || styles.align;
    const fontSize = styles.font_size_pt || styles.fontSize || 11; // Ensure default size

    // Explicitly set a default color if not provided to override marker inheritance
    if (styles.font_color && styles.font_color !== 'default') {
        element.setForegroundColor(styles.font_color);
    } else if (styles.color) {
        element.setForegroundColor(styles.color);
    } else {
        // We MUST set this explicitly to override the 1pt white marker style inheritance
        element.setForegroundColor('#000000');
    }

    if (alignment) {
        const align = alignment === 'CENTER' ? DocumentApp.HorizontalAlignment.CENTER :
            alignment === 'RIGHT' ? DocumentApp.HorizontalAlignment.RIGHT :
                alignment === 'JUSTIFIED' ? DocumentApp.HorizontalAlignment.JUSTIFIED :
                    DocumentApp.HorizontalAlignment.LEFT;
        element.setAlignment(align);
    }

    // Always ensure a readable font size to override marker inheritance
    element.setFontSize(fontSize);
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

/**
 * Styles a paragraph to be an invisible marker (1pt, white).
 */
function applyMarkerStyle(paragraph) {
    if (!paragraph) return;
    try {
        const text = paragraph.editAsText();
        text.setFontSize(1);
        text.setForegroundColor('#FFFFFF');
        paragraph.setSpacingBefore(0);
        paragraph.setSpacingAfter(0);
    } catch (e) {
        console.warn("Failed to apply marker style:", e);
    }
}

/**
 * Verifies if both start and end markers for a blockId are present in the document.
 */
function checkMarkersIntact(blockId) {
    try {
        const body = DocumentApp.getActiveDocument().getBody();
        const startFound = body.findText(`\\[§${blockId}§\\]`);
        const endFound = body.findText(`\\[§/${blockId}§\\]`);

        if (startFound && endFound) {
            return { intact: true, error: null };
        }
        return {
            intact: false,
            error: `Start/end marker missing for section: ${blockId}.`
        };
    } catch (e) {
        return { intact: false, error: e.toString() };
    }
}

/**
 * Extracts the current text content between markers for a given blockId.
 * Used by the backend/sidebar to provide context for edits.
 */
function getSectionContent(blockId) {
    const doc = DocumentApp.getActiveDocument();
    const body = doc.getBody();
    const startRange = body.findText(`\\[§${blockId}§\\]`);
    const endRange = body.findText(`\\[§/${blockId}§\\]`);

    if (!startRange || !endRange) {
        throw new Error(`Markers for ${blockId} not found.`);
    }

    const startMarkerParagraph = startRange.getElement().getParent();
    const endMarkerParagraph = endRange.getElement().getParent();

    const startIndex = body.getChildIndex(startMarkerParagraph);
    const endIndex = body.getChildIndex(endMarkerParagraph);

    let contentText = "";
    for (let i = startIndex + 1; i < endIndex; i++) {
        const child = body.getChild(i);
        const type = child.getType();
        if (type === DocumentApp.ElementType.PARAGRAPH) {
            contentText += child.asParagraph().getText() + "\n";
        } else if (type === DocumentApp.ElementType.LIST_ITEM) {
            contentText += child.asListItem().getText() + "\n";
        } else if (type === DocumentApp.ElementType.TABLE) {
            contentText += "[Table Content]\n";
        }
    }

    return {
        content: contentText.trim(),
        startIndex: startIndex + 1,
        endIndex: endIndex - 1
    };
}

/**
 * Surgical replacement of section content based on markers.
 */
function replaceSectionByMarkers(blockId, blocks) {
    const doc = DocumentApp.getActiveDocument();
    const body = doc.getBody();
    const startRange = body.findText(`\\[§${blockId}§\\]`);
    const endRange = body.findText(`\\[§/${blockId}§\\]`);

    if (!startRange || !endRange) {
        throw new Error("Section markers missing. Surgical edit failed.");
    }

    const startMarkerParagraph = startRange.getElement().getParent().asParagraph();
    const endMarkerParagraph = endRange.getElement().getParent().asParagraph();

    const startIndex = body.getChildIndex(startMarkerParagraph) + 1;
    const endIndex = body.getChildIndex(endMarkerParagraph) - 1;

    // 1. Delete old content between markers (backwards to preserve indices)
    for (let i = endIndex; i >= startIndex; i--) {
        body.removeChild(body.getChild(i));
    }

    // 2. Render new blocks at the startIndex
    renderBlocks(body, blocks, startIndex);

    // 3. Ensure markers remain invisible
    applyMarkerStyle(startMarkerParagraph);
    applyMarkerStyle(endMarkerParagraph);

    doc.saveAndClose();
}

/**
 * Detects if the user has selected text and identifies which section it belongs to.
 */
function getSelectedTextInfo() {
    try {
        const doc = DocumentApp.getActiveDocument();
        const selection = doc.getSelection();

        if (!selection) return null;

        const rangeElements = selection.getRangeElements();
        if (rangeElements.length === 0) return null;

        let selectedText = "";
        rangeElements.forEach(re => {
            const el = re.getElement();
            if (el.asText) {
                const textEl = el.asText();
                const text = textEl.getText();
                if (re.isPartial()) {
                    selectedText += text.substring(re.getStartOffset(), re.getEndOffsetInclusive() + 1);
                } else {
                    selectedText += text;
                }
            }
        });

        // Identify which block it belongs to by looking at markers around the first selected element
        let blockId = null;
        const firstRangeEl = rangeElements[0];
        const firstEl = firstRangeEl.getElement();
        const body = doc.getBody();

        // Find the parent element that is a direct child of the body
        let topChild = firstEl;
        while (topChild && topChild.getParent() && topChild.getParent().getType() !== DocumentApp.ElementType.BODY_SECTION) {
            topChild = topChild.getParent();
        }

        if (topChild && topChild.getParent()) {
            let childIndex = body.getChildIndex(topChild);
            // Look backwards for a start marker [§...§]
            for (let i = childIndex; i >= 0; i--) {
                let p = body.getChild(i);
                if (p.getType() === DocumentApp.ElementType.PARAGRAPH) {
                    let text = p.asParagraph().getText();
                    let match = text.match(/\[§(.*?)§\]/);
                    if (match && !text.includes('/')) {
                        blockId = match[1];
                        break;
                    }
                }
            }
        }

        return {
            text: selectedText.trim(),
            blockId: blockId
        };
    } catch (e) {
        console.error("Error in getSelectedTextInfo:", e);
        return null;
    }
}

