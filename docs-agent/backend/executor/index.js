const { handleCreate } = require('./createExecutor');
const { handlePatch } = require('./patchExecutor');
const { handleInsert } = require('./insertExecutor');

module.exports = {
    handleCreate,
    handlePatch,
    handleInsert
};
