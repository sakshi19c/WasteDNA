const test = require("node:test");
const assert = require("node:assert/strict");
const { accessCode } = require("../middleware/accessCode");

function run(header, required) {
    if (required === undefined) delete process.env.ACCESS_CODE;
    else process.env.ACCESS_CODE = required;

    let status = 200;
    let nexted = false;
    const req = { get: () => header };
    const res = { status(code) { status = code; return this; }, json() {} };
    accessCode(req, res, () => { nexted = true; });
    delete process.env.ACCESS_CODE;
    return { status, nexted };
}

test("open when no ACCESS_CODE is configured", () => {
    assert.equal(run(undefined, undefined).nexted, true);
});

test("accepts the right code and rejects missing or wrong ones", () => {
    assert.equal(run("secret", "secret").nexted, true);
    assert.deepEqual(run("wrong!", "secret"), { status: 401, nexted: false });
    assert.deepEqual(run(undefined, "secret"), { status: 401, nexted: false });
    assert.deepEqual(run("", "secret"), { status: 401, nexted: false });
});
