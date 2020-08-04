"use strict";

const express = require("express");
const app = express();
const handler = require("./dist/index").default;

if (process.env.RAW_BODY === "true") {
    app.use(bodyParser.raw({ type: "*/*" }));
} else {
    var bodyLimit = process.env.MAX_BODY_SIZE || "100kb"; //body-parser default
    app.use(express.json({ limit: bodyLimit })); //-- for parsing application/json
    app.use(express.urlencoded({ extended: true, limit: bodyLimit })); //-- for parsing application/x-www-form-urlencoded
    app.use(express.text({ type: "text/*" })); //-- for parsing text content
    app.use(express.raw({ limit: bodyLimit, limit: bodyLimit })); // "Content-Type: application/octet-stream"
}

app.disable("x-powered-by");

const middleware = async (req, res) => {
    try {
        if (typeof handler !== "function") {
            throw new Error("imported function is not in function type!");
        }
        /**
         * req.body will contain unserialised data if json data context-type is sent
         * req & res are provided for full control of request handling process
         * return `res` to stop this middleware from handling repsonse for you
         */
        const result = await handler(req.body, req, res);

        if (typeof result === "string") {
            // --- if it's string, output as plain text rather than json
            // --- this will be convenient for text based processing functions
            res.set("Content-Type", "text/plain");
            res.status(200).send(result);
        } else if (result === res) {
            // --- function returns the identical `res` indicates that the response has been sent
            // --- i.e. the function'd like to provide a customised response
            return;
        } else {
            res.status(200).json(result);
        }
    } catch (e) {
        console.error(e);
        res.set("Content-Type", "text/plain");
        if (e.stack) {
            res.status(500).send("" + e.stack);
        } else {
            res.status(500).send("" + e);
        }
    }
};

app.get("/healthz", (req, res) => {
    res.status(200).send("OK");
});
app.post("/*", middleware);
app.get("/*", middleware);
app.patch("/*", middleware);
app.put("/*", middleware);
app.delete("/*", middleware);

const port = process.env.http_port || 3000;

app.listen(port, () => {
    console.log(`OpenFaaS Node.js listening on port: ${port}`);
});
