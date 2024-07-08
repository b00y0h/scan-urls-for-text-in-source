const fs = require("fs");
const axios = require("axios");

// Check if the API URL is provided
if (process.argv.length < 3) {
  console.error("Usage: node scan.js <api_url> optional:<search_string>");
  process.exit(1);
}

const apiUrl =
  "http://universities.hipolabs.com/search?country=United%20States";
// Capture the search string from the command line or use default
const searchString = process.argv[2] || "data-partnerurl";
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
  // console log the API URL and the searchString
  console.log(`Scanning for: ${searchString} in ${apiUrl}`);
  try {
    // Fetch the data from the API
    const response = await axios.get(apiUrl);
    const universities = response.data;

    // Extract URLs from the "web_pages" array in the API response
    const urls = universities.reduce(
      (acc, uni) => acc.concat(uni.web_pages),
      []
    );

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
          currentUrl++;
          fs.appendFileSync(errorUrl, `${error.message}: ${url}\n`);
          // console.error(`Error processing URL ${url}: ${error.message}`);
          // console log that we're skipping the URL
          console.error(`Error: ${currentUrl} of ${totalUrls}: ${url}`);
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
  } catch (err) {
    console.error(`Failed to fetch data from API: ${err.message}`);
  }
}

checkUrls();
