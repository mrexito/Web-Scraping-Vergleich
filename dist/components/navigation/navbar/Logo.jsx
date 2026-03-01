"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var link_1 = __importDefault(require("next/link"));
var Logo = function () {
    // Update the size of the logo when the size of the screen changes
    var _a = (0, react_1.useState)(0), width = _a[0], setWidth = _a[1];
    var updateWidth = function () {
        var newWidth = window.innerWidth;
        setWidth(newWidth);
    };
    (0, react_1.useEffect)(function () {
        window.addEventListener("resize", updateWidth);
        updateWidth();
        return function () { return window.removeEventListener("resize", updateWidth); };
    }, []);
    return (<>
      <link_1.default href="/">
        <p className="text-2xl text-cr-darkgrey">Crowdfunding-Comparison</p>
      </link_1.default>
    </>);
};
exports.default = Logo;
