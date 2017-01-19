import assert from "assert";
import { NumberUtils } from "../../lib";

describe("Number utils", () => {

    it("to implied decimal", ()=> {
        assert.equal("1", NumberUtils.toImpliedDecimal(1, 0))
        assert.equal("10", NumberUtils.toImpliedDecimal(1, 1))
        assert.equal("100", NumberUtils.toImpliedDecimal(1, 2))
        assert.equal("10", NumberUtils.toImpliedDecimal(".1", 2))
        assert.equal("10", NumberUtils.toImpliedDecimal("0.1", 2))
        assert.equal("10", NumberUtils.toImpliedDecimal("00.1", 2))
        assert.equal("10", NumberUtils.toImpliedDecimal("00.10", 2))
        assert.throws(()=> NumberUtils.toImpliedDecimal("00.100", 2))
        assert.throws(()=> NumberUtils.toImpliedDecimal(9007199254740991 + 1, 1))
    })


})
