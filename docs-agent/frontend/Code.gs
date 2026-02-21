/**
 * @OnlyCurrentDoc
 */

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

function processPrompt(prompt) {
    try {
        Utilities.sleep(1000);
        return "AI Response: I see you're asking about '" + prompt + "'. How can I assist you further with this document?";
    } catch (error) {
        return "Error: " + error.toString();
    }
}
