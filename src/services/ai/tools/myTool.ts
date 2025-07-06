import { ToolDefinition } from "../../../types/ai";

export const getWeather: ToolDefinition = {
  name: "get_weather",
  description: "Get the current weather for a city.",
  parameters: [
    { name: "city", type: "string", description: "City name", required: true },
  ],
  handler: async (args, context) => {
    // Example: fetch from a weather API
    const city = args.city;
    // Replace with real API call
    return { city, weather: "sunny", tempC: 25 };
  },
};
