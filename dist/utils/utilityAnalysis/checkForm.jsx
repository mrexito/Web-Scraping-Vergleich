"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkForm = void 0;
var checkForm = function (params) {
    // check if all attributes are set
    var allAttributesSet = params.every(function (param) { return param.criteria !== '' && param.weight !== undefined; });
    var correctType = params.every(function (param) { return !isNaN(Number(param.weight)); });
    var correctSumOfWeights = params.reduce(function (sum, param) { return sum + Number(param.weight); }, 0) === 100;
    var doubleCriteria = !params.every(function (param) { return params.filter(function (p) { return p.criteria === param.criteria; }).length === 1; });
    // check if form is correct and give specific error messages
    if (allAttributesSet && correctType && correctSumOfWeights && !doubleCriteria) {
        return true;
    }
    else if (!allAttributesSet) {
        return ('Some attributes are not set - Please check your input');
    }
    else if (!correctType) {
        return ('Some attributes are not numbers - Please check your input');
    }
    else if (!correctSumOfWeights) {
        return ('Sum of weights is not 100% - Please check your input');
    }
    else if (doubleCriteria) {
        return ('Some criteria are double - Please check your input');
    }
    return allAttributesSet && correctType && correctSumOfWeights && !doubleCriteria;
};
exports.checkForm = checkForm;
