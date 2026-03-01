export const checkForm = (params: any) => {
    // check if all attributes are set
    const allAttributesSet = params.every((param: { criteria: string; weight: number; }) => param.criteria !== '' && param.weight !== undefined);
    const correctType = params.every((param: { weight: string; }) => !isNaN(Number(param.weight)));
    const correctSumOfWeights = params.reduce((sum: number, param: { weight: string; }) => sum + Number(param.weight), 0) === 100;
    const doubleCriteria = !params.every((param: { criteria: string; }) => params.filter((p: { criteria: string; }) => p.criteria === param.criteria).length === 1);

    // check if form is correct and give specific error messages
    if (allAttributesSet && correctType && correctSumOfWeights && !doubleCriteria) {
        return true;
    } else if (!allAttributesSet) {
        return ('Some attributes are not set - Please check your input');
    } else if (!correctType) {
        return ('Some attributes are not numbers - Please check your input');
    } else if (!correctSumOfWeights) {
        return ('Sum of weights is not 100% - Please check your input');
    } else if (doubleCriteria) {
        return ('Some criteria are double - Please check your input');
    }

    return allAttributesSet && correctType && correctSumOfWeights && !doubleCriteria;
};
