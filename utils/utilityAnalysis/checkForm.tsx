export const checkForm = (params: any) => {
  const allAttributesSet = params.every(
    (param: { criteria: string; weight: number }) =>
      param.criteria !== '' && param.weight !== undefined
  );
  const correctType = params.every(
    (param: { weight: string }) => !isNaN(Number(param.weight))
  );
  const correctSumOfWeights =
    params.reduce(
      (sum: number, param: { weight: string }) => sum + Number(param.weight),
      0
    ) === 100;
  const doubleCriteria = !params.every(
    (param: { criteria: string }) =>
      params.filter((p: { criteria: string }) => p.criteria === param.criteria).length === 1
  );

  if (allAttributesSet && correctType && correctSumOfWeights && !doubleCriteria) {
    return true;
  } else if (!allAttributesSet) {
    // FIX: Deutsche Fehlermeldung
    return 'Nicht alle Felder ausgefüllt – bitte Eingabe prüfen.';
  } else if (!correctType) {
    // FIX: Deutsche Fehlermeldung
    return 'Gewichtungen müssen Zahlen sein – bitte Eingabe prüfen.';
  } else if (!correctSumOfWeights) {
    // FIX: Deutsche Fehlermeldung
    return 'Die Summe der Gewichtungen muss 100% ergeben.';
  } else if (doubleCriteria) {
    // FIX: Deutsche Fehlermeldung
    return 'Jedes Kriterium darf nur einmal ausgewählt werden.';
  }

  return allAttributesSet && correctType && correctSumOfWeights && !doubleCriteria;
};
