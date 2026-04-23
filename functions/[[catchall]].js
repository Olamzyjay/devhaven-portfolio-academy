import * as chat from "./_impl/chat.js";
import * as askOpenAI from "./_impl/ask-openai.js";
import * as paystackInit from "./_impl/paystack-init.js";
import * as paystackVerify from "./_impl/paystack-verify.js";

function pickHandler(name, method) {
  const upper = String(method || "").toUpperCase();

  if (name === "chat") {
    if (upper === "OPTIONS") return chat.options;
    if (upper === "POST") return chat.post;
  }

  if (name === "ask-openai" && upper === "POST") {
    return askOpenAI.post;
  }

  if (name === "paystack-init" && upper === "POST") {
    return paystackInit.post;
  }

  if (name === "paystack-verify" && upper === "GET") {
    return paystackVerify.get;
  }

  return null;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const prefix = "/.netlify/functions/";

  if (!url.pathname.startsWith(prefix)) {
    return new Response("Not found", { status: 404 });
  }

  const rest = url.pathname.slice(prefix.length);
  const name = rest.split("/").filter(Boolean)[0] || "";

  const handler = pickHandler(name, context.request.method);
  if (!handler) {
    return new Response("Method not allowed", { status: 405 });
  }

  return handler(context);
}

