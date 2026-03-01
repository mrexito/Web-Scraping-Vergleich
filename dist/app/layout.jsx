"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadata = void 0;
exports.default = RootLayout;
var navigation_1 = __importDefault(require("../components/navigation"));
var sans_1 = require("geist/font/sans");
require("./globals.css");
var defaultUrl = process.env.VERCEL_URL
    ? "https://".concat(process.env.VERCEL_URL)
    : 'http://localhost:3000';
exports.metadata = {
    metadataBase: new URL(defaultUrl),
    title: 'Gymi Preparation Course Scoring System',
    description: 'Gymi Preparation Course Scoring System - A tool to compare preparation course providers'
};
function RootLayout(_a) {
    var children = _a.children;
    return (<html lang="en" className={sans_1.GeistSans.className}>
      <body className="bg-background text-foreground">
        <main className="min-h-screen flex flex-col items-center">
          <navigation_1.default />
          {children}
        </main>
      </body>
    </html>);
}
