"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var navbar_1 = __importDefault(require("./navbar"));
var sidebar_1 = __importDefault(require("./sidebar"));
var Navigation = function () {
    // toggle sidebar
    var _a = (0, react_1.useState)(false), isOpen = _a[0], setIsOpen = _a[1];
    var toggle = function () {
        setIsOpen(!isOpen);
    };
    return (<>
      <sidebar_1.default isOpen={isOpen} toggle={toggle}/>
      <navbar_1.default toggle={toggle}/>
    </>);
};
exports.default = Navigation;
