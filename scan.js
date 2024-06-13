const fs = require("fs");
const readline = require("readline");
const axios = require("axios");

// Check if the input file is provided
if (process.argv.length < 3) {
  console.error("Usage: node scan.js <file_with_urls>");
  process.exit(1);
}

const inputFile = process.argv[2];
const withPartnerUrl = "with_form.txt";
const withoutPartnerUrl = "without_form.txt";
const errorUrl = "error_url.txt";

// Empty the output files if they exist
fs.writeFileSync(withPartnerUrl, "");
fs.writeFileSync(withoutPartnerUrl, "");
fs.writeFileSync(errorUrl, "");

function processContent(contentResponse, url, currentUrl, totalUrls) {
  if (contentResponse.data.includes("data-partnerurl")) {
    fs.appendFileSync(withPartnerUrl, `${url}\n`);
    console.log(`Finished: ${currentUrl} of ${totalUrls}: ✅ : ${url}`);
  } else {
    fs.appendFileSync(withoutPartnerUrl, `${url}\n`);
    console.log(`Finished: ${currentUrl} of ${totalUrls}: ❌`);
  }
}

async function checkUrls() {
  const fileStream = fs.createReadStream(inputFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let totalUrls = 0;
  const urls = [];

  for await (const line of rl) {
    urls.push(line);
    totalUrls++;
  }

  let currentUrl = 0;

  for (const url of urls) {
    currentUrl++;
    process.stdout.write(`Scanning... ${currentUrl} of ${totalUrls}\r`);
    try {
      const response = await axios.head(url, {
        validateStatus: function (status) {
          // Resolve the promise when the status code is less than 500
          return status < 500;
        },
      });

      if (response.status === 200) {
        const contentResponse = await axios.get(url);
        processContent(contentResponse, url, currentUrl, totalUrls);
      } else if (response.status === 301) {
        const location = response.headers.location;
        const contentResponse = await axios.get(location);
        processContent(contentResponse, url, currentUrl, totalUrls);
      } else if (response.status === 404) {
        // no content b/c of 404 so just write to file
        fs.appendFileSync(errorUrl, `404: ${url}\n`);
        console.log(
          `Finished: ${currentUrl} of ${totalUrls}: 404 error for ${url}`
        );
      } else if (response.status === 403) {
        // no content b/c of unauthorized so just write to file
        fs.appendFileSync(errorUrl, `403: ${url}\n`);
        console.log(
          `Finished: ${currentUrl} of ${totalUrls}: ❌ 403 error for ${url}`
        );
      } else {
        // no content (probably b/c of so 'nosniff' just write to file
        fs.appendFileSync(errorUrl, `Unknown: ${url}\n`);
        console.log(
          `Finished: ${currentUrl} of ${totalUrls}: Unknown error for ${url}`
        );
      }
    } catch (error) {
      fs.appendFileSync(errorUrl, `Unknown: ${url}\n`);
      console.log(
        `Finished: ${currentUrl} of ${totalUrls}: Error for ${url}: ${error.message}`
      );
    }
  }

  // setup counts for each category
  const withPartnerUrlCount = fs
    .readFileSync(withPartnerUrl, "utf-8")
    .split("\n")
    .filter(Boolean).length;
  const withoutPartnerUrlCount = fs
    .readFileSync(withoutPartnerUrl, "utf-8")
    .split("\n")
    .filter(Boolean).length;
  const withErrorUrlCount = fs
    .readFileSync(errorUrl, "utf-8")
    .split("\n")
    .filter(Boolean).length;

  // print out the report
  console.log("\nReport generated:");
  console.log(`URLs with EAB Form: ${withPartnerUrlCount}`);
  console.log(`URLs without EAB Form: ${withoutPartnerUrlCount}`);
  console.log(`URLs with Error: ${withErrorUrlCount}`);
  console.log("---------------------------------");
  console.log(`Total URLs scanned: ${totalUrls}`);

  // check if the total matches the sum of the three categories
  if (
    totalUrls !==
    withPartnerUrlCount + withoutPartnerUrlCount + withErrorUrlCount
  ) {
    console.error(
      "The total does not match the sum of the three categories. Please check the script."
    );
  }

  // Read all lines from the withPartnerUrl file
  const withPartnerUrlLines = fs
    .readFileSync(withPartnerUrl, "utf-8")
    .split("\n")
    .filter(Boolean);

  console.log("\nURLs with EAB Form:");
  withPartnerUrlLines.forEach((url) => {
    console.log(`✅ ${url}`);
  });
}

checkUrls();
