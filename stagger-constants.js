/**
 * Exact stagger fractions (percent). Slider is inverted: stagger = 100 - sliderValue.
 */
(function (global) {
  "use strict";

  const ONE_THIRD = 100 / 3;
  const TWO_THIRDS = 200 / 3;

  global.StaggerConstants = {
    ONE_THIRD: ONE_THIRD,
    TWO_THIRDS: TWO_THIRDS,
    /** Slider value for ⅓ stagger (displayed percent) */
    sliderForOneThird: 100 - ONE_THIRD,
    /** Slider value for ⅔ stagger (displayed percent) */
    sliderForTwoThirds: 100 - TWO_THIRDS,
  };
})(typeof window !== "undefined" ? window : global);
