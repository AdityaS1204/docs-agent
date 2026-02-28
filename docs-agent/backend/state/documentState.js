class DocumentState {
    constructor() {
        this.outline = [];
        this.summaries = {};
        this.orderedBlockIds = [];
    }

    updateState(newState) {
        this.outline = newState.outline;
        this.summaries = newState.summaries;
        this.orderedBlockIds = newState.orderedBlockIds;
    }

    getState() {
        return {
            outline: this.outline,
            summaries: this.summaries,
            orderedBlockIds: this.orderedBlockIds
        };
    }
}

module.exports = new DocumentState();
