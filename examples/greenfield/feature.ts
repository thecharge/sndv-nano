/**
 * Greenfield example: Adding avatar upload to a user profile.
 *
 * Simplest SMEP workflow:
 * 1. Define what must NEVER happen (constraints)
 * 2. Try to break your own feature
 * 3. Whatever survives is your solution
 *
 * Run: bun run examples/greenfield/feature.ts
 */
import { Protocol, summary, type TaskContextInterface } from "@thecharge/sndv-nano";

const protocol = new Protocol({
	goal: "Add user profile avatar upload",
	constraints: [
		"Images must be under 2MB",
		"Only JPEG and PNG formats",
		"No breaking changes to user API",
	],
});

// Highest risk first: can we actually enforce the size limit?
protocol.addTask(
	async (ctx: TaskContextInterface) => {
		const oversizedFile = { size: 5_000_000, type: "image/png" };
		const rejected = oversizedFile.size > 2_000_000;

		ctx.evidence("file_size", oversizedFile.size);
		ctx.evidence("was_rejected", rejected);

		if (!rejected) ctx.falsify("Oversized file was accepted");
	},
	{ name: "verify_upload_size_limit", risk: 0.9 },
);

// Can we bypass format validation?
protocol.addTask(
	async (ctx: TaskContextInterface) => {
		const sneakyFormats = ["image/svg+xml", "image/gif", "image/webp"];
		const allowed = new Set(["image/jpeg", "image/png"]);
		const allBlocked = sneakyFormats.every((fmt) => !allowed.has(fmt));

		ctx.evidence("formats_tested", sneakyFormats.length);
		ctx.evidence("all_blocked", allBlocked);

		if (!allBlocked) ctx.falsify("Non-allowed format snuck through");
	},
	{ name: "verify_format_validation", risk: 0.8 },
);

// Only runs if upload validation works: does existing API still work?
protocol.addTask(
	async (ctx: TaskContextInterface) => {
		const endpoints = ["/user/profile", "/user/settings"];
		const allWorking = endpoints.every(() => true); // simulate

		ctx.evidence("endpoints_checked", endpoints.length);
		ctx.evidence("all_working", allWorking);

		if (!allWorking) ctx.falsify("Existing endpoint broke");
	},
	{
		name: "verify_api_compatibility",
		risk: 0.6,
		dependsOn: ["verify_upload_size_limit", "verify_format_validation"],
	},
);

const report = await protocol.execute();
console.log(summary(report));
