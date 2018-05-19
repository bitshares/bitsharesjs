import ee from "event-emitter";
var _emitter;
export default function emitter() {
    if (!_emitter) {
        _emitter = ee({});
    }
    return _emitter;
}
