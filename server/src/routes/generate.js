/**
 * Express Router for API handler to generate vuepress static site from user inputs
 * Mounted on /generate
 * @author JJ
 * @module Default routes
 */

const express = require("express");
const router = express.Router();
const fs = require("fs").promises;
const logger = require("@lionellbriones/logging").default("routes:generate");

const createDirIfDontExists = require("../utils/createDirIfDontExists");
const generateVuepressSite = require("generate-vuepress-site");
const createBucket = require("../utils/createBucket");
const uploadDir = require("../utils/uploadDirGS");

function generateJsonFromMarkdown(markdown) {}
function generateMarkdownFromJson(json) {
  return JSON.stringify(json);
}

/**
 * Generate vuepress site from json
 *
 * @todo Add stats tracking, so after every generation or failure, update the event system
 *
 * @name POST /generate
 * @returns {Status} 200
 */
router.post("/", express.json(), async (req, res) => {
  try {
    const { customerID } = req.query;

    // @todo Track and limit user updates for the site according to their plan

    // Create the dir for the markdown files themselves
    createDirIfDontExists(`/tmp/vuepress-markdown/${customerID}`);

    // @todo Can there be more then 1 file?
    const markdownFilePath = `/tmp/vuepress-markdown/${customerID}/README.md`;

    // @todo primarily for testing -- Change to use storage service instead of the ephemeral container storage
    await fs.writeFile(markdownFilePath, generateMarkdownFromJson(req.body), {
      flag: "w",
    });

    // start async background job to generate the site and push live when done.
    // @todo Should we use seperate processes? Or like torus relayer split into diff rabbitmq processes
    await generateVuepressSite(
      // Pass in dir of the markdown files instead of just the README file itself.
      `/tmp/vuepress-markdown/${customerID}`,
      `/tmp/vuepress-generated/${customerID}`
    );

    // @todo Update stats in DB

    // Create bucket if it does not exists yet
    await createBucket(`ekd-faq-builder-customer-${customerID}`);

    // Push site live to static hosting service
    await uploadDir(
      `/tmp/vuepress-generated/${customerID}`,
      `ekd-faq-builder-customer-${customerID}`
    );

    // @todo Clean up, delete the directory

    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
