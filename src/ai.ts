import OpenAI from "openai";
import { readFileSync } from "fs";

export const prompt = readFileSync("data/prompt.txt", "utf-8");

export const client = new OpenAI({
    baseURL: process.env.DEEPSEEK_BASE_URL,
    apiKey: process.env.DEEPSEEK_API_KEY,
});
