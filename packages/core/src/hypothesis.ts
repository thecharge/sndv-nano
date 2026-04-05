import {
	type Hypothesis,
	type HypothesisInput,
	HypothesisSchema,
	SmepErrors,
} from "@thecharge/sndv-config";

/** Create and validate a Hypothesis from raw input. */
export const createHypothesis = (input: HypothesisInput): Hypothesis =>
	HypothesisSchema.parse(input);

/** Throw ConstraintViolation if `violated` is true. */
export const checkConstraint = (label: string, violated: boolean, detail = ""): void => {
	if (!violated) return;
	throw SmepErrors.constraintViolation(label, detail);
};
