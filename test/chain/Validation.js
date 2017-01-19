import { ChainValidation } from "../../lib";
import assert from "assert";

describe("ChainValidation", () => {


    describe("is_object_id", () => {
        it("Is valid object id", ()=> {
            assert(ChainValidation.is_object_id("1.3.0") === true);
        })

        it("Is not valid object id", ()=> {
            assert(ChainValidation.is_object_id("1.3") === false);
        })

        it("Not string", ()=> {
            assert(ChainValidation.is_object_id(3) === false);
        })
    })


});
