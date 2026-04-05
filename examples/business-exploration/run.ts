/**
 * Example: Business exploration — Falsify a SaaS hypothesis.
 *
 * Use SMEP to attack a business idea before investing time building.
 * Each task tries to KILL the idea, not validate it.
 *
 * Run: bun run examples/business-exploration/run.ts
 */
import { Protocol, summary, type TaskContextInterface } from "@thecharge/sndv-nano";

const protocol = new Protocol(
	{
		goal: "Evaluate product-market fit for AI code review SaaS",
		constraints: [
			"Must differentiate from Copilot and CodeRabbit",
			"Target: teams of 10-50 devs",
			"$20-50/seat/month",
			"$1M ARR in 18 months",
		],
	},
	{ maxIterations: 20 },
);

protocol.addTask(
	async (ctx: TaskContextInterface) => {
		const competitors = ["GitHub Copilot", "CodeRabbit", "Codacy", "SonarCloud"];
		const differentiation = "Security-focused review with compliance reporting";
		const isUnique = !competitors.some((c) => c.includes("compliance"));

		ctx.evidence("competitors_analyzed", competitors.length);
		ctx.evidence("proposed_differentiation", differentiation);
		ctx.evidence("is_unique", isUnique);

		if (!isUnique) ctx.falsify("No meaningful differentiation found");
	},
	{ name: "verify_market_differentiation", risk: 0.95 },
);

protocol.addTask(
	async (ctx: TaskContextInterface) => {
		const teamsGlobal = 200_000;
		const relevantSegment = 0.3;
		const willingToPay = 0.1;
		const realisticSeats = teamsGlobal * relevantSegment * willingToPay * 30;
		const tam = realisticSeats * 30 * 12;

		ctx.evidence("realistic_seats", realisticSeats);
		ctx.evidence("tam_annual", tam);

		if (tam < 10_000_000) {
			ctx.falsify(`TAM too small: $${(tam / 1_000_000).toFixed(1)}M — need >$10M`);
		}
	},
	{ name: "verify_tam_sizing", risk: 0.9 },
);

protocol.addTask(
	async (ctx: TaskContextInterface) => {
		const avgTokensPerReview = 8000;
		const costPer1kTokens = 0.01;
		const reviewsPerSeatPerMonth = 40;
		const costPerSeat = ((avgTokensPerReview * costPer1kTokens) / 1000) * reviewsPerSeatPerMonth;
		const revenuePerSeat = 30;
		const grossMargin = (revenuePerSeat - costPerSeat) / revenuePerSeat;

		ctx.evidence("cost_per_seat_month", costPerSeat.toFixed(2));
		ctx.evidence("gross_margin", `${(grossMargin * 100).toFixed(1)}%`);

		if (grossMargin < 0.6) {
			ctx.falsify(`Gross margin ${(grossMargin * 100).toFixed(1)}% too low — need >60%`);
		}
	},
	{ name: "verify_unit_economics", risk: 0.85 },
);

protocol.addTask(
	async (ctx: TaskContextInterface) => {
		const monthlyChurn = 0.08;
		const expansionRevenue = 0.03;
		const netChurn = monthlyChurn - expansionRevenue;

		ctx.evidence("monthly_churn", `${(monthlyChurn * 100).toFixed(1)}%`);
		ctx.evidence("net_churn", `${(netChurn * 100).toFixed(1)}%`);

		if (netChurn > 0.05) {
			ctx.falsify(`Net churn ${(netChurn * 100).toFixed(1)}% too high for SaaS viability`);
		}
	},
	{ name: "verify_retention", risk: 0.75, dependsOn: ["verify_unit_economics"] },
);

const report = await protocol.execute();
console.log(summary(report));
