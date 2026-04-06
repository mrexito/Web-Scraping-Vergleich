import type { ScoringParam } from '@/store/scoringStore';

export const checkForm = (params: ScoringParam[]): true | string => {
  const allAttributesSet = params.every(
    (param) => param.criteria !== '' && param.weight !== undefined
  );
  const correctType = params.every(
    (param) => !isNaN(Number(param.weight))
  );
  const correctSumOfWeights =
    params.reduce(
      (sum, param) => sum + Number(param.weight),
      0
    ) === 100;
  const doubleCriteria = !params.every(
    (param) =>
      params.filter((p) => p.criteria === param.criteria).length === 1
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
