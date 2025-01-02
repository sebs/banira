"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestClass = void 0;
var TestClass = /** @class */ (function () {
    function TestClass(greeting) {
        if (greeting === void 0) { greeting = "Hello"; }
        this.greeting = greeting;
    }
    TestClass.prototype.sayHello = function () {
        return "".concat(this.greeting, ", World!");
    };
    return TestClass;
}());
exports.TestClass = TestClass;
