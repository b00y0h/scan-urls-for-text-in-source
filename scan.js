const fs = require("fs");
const readline = require("readline");
const axios = require("axios");

// Check if the input file is provided
if (process.argv.length < 3) {
  console.error(
    "Usage: node scan.js <file_with_urls> optional:<search_string>"
  );
  process.exit(1);
}

const inputFile = process.argv[2];
// Capture the search string from the command line or use default
const searchString = process.argv[3] || "data-partnerurl";
const withPartnerUrl = "with_text.txt";
const withoutPartnerUrl = "without_text.txt";
const errorUrl = "error_url.txt";

// Empty the output files if they exist
fs.writeFileSync(withPartnerUrl, "");
fs.writeFileSync(withoutPartnerUrl, "");
fs.writeFileSync(errorUrl, "");

function processContent(
  contentResponse,
  url,
  currentUrl,
  totalUrls,
  searchString
) {
  if (contentResponse.data.includes(searchString)) {
    fs.appendFileSync(withPartnerUrl, `${url}\n`);
    console.log(`Finished: ${currentUrl} of ${totalUrls}: ✅ : ${url}`);
  } else {
    fs.appendFileSync(withoutPartnerUrl, `${url}\n`);
    console.log(`Finished: ${currentUrl} of ${totalUrls}: ❌ : ${url}`);
  }
}

async function checkUrls() {
  const fileStream = fs.createReadStream(inputFile);
  // write to the console what file was read
  process.stdout.write(`Scanning for: ${searchString} in ${inputFile}\n`);

  // Create a readline interface
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  // let totalUrls = 0;
  const urls = [];

  // Read each line from the file and push it to the urls array
  for await (const line of rl) {
    urls.push(line);
    // totalUrls++;
  }

  let currentUrl = 0;

  const totalUrls = urls.length;

  const requests = urls.map((url) => {
    return axios
      .head(url, {
        validateStatus: function (status) {
          return status < 500; // Accept statuses less than 500
        },
      })
      .then((response) => {
        if (response.status === 200 || response.status === 301) {
          // For 301 redirects, use the location header for the GET request
          const targetUrl =
            response.status === 301 ? response.headers.location : url;
          return axios.get(targetUrl);
        } else {
          throw new Error(`Status code ${response.status} for URL: ${url}`);
        }
      })
      .then((contentResponse) => {
        currentUrl++;
        processContent(
          contentResponse,
          url,
          currentUrl,
          totalUrls,
          searchString
        );
      })
      .catch((error) => {
        fs.appendFileSync(errorUrl, `${error.message}: ${url}\n`);
        console.error(`Error processing URL ${url}: ${error.message}`);
      });
  });

  await Promise.allSettled(requests);
  console.log("All URLs have been processed.");

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
  console.log(`URLs with ${searchString}: ${withPartnerUrlCount}`);
  console.log(`URLs without ${searchString}: ${withoutPartnerUrlCount}`);
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
