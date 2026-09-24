const webUrl = readHttpsUrl('PRODUCTION_WEB_URL');
const apiUrl = readHttpsUrl('PRODUCTION_API_URL');

await checkJson(`${apiUrl}/health`, (body) => {
  if (body?.service !== 'boardnest-api' || body?.status !== 'ok') {
    throw new Error('The API health response has an unexpected body.');
  }
});

await checkText(webUrl, (body) => {
  if (!body.toLowerCase().includes('<!doctype html>')) {
    throw new Error('The web deployment did not return an HTML document.');
  }
});

await checkJson(
  `${apiUrl}/graphql`,
  (body) => {
    if (body?.data?.__typename !== 'Query') {
      throw new Error('The GraphQL endpoint returned an unexpected response.');
    }
  },
  {
    body: JSON.stringify({ query: 'query ProductionSmoke { __typename }' }),
    headers: {
      'content-type': 'application/json',
      origin: webUrl,
    },
    method: 'POST',
  },
);

console.log('Production smoke checks passed.');

function readHttpsUrl(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);

  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS.`);
  }

  return url.origin;
}

async function checkJson(url, validate, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}.`);
  }
  validate(await response.json());
  console.log(`OK ${response.status} ${url}`);
}

async function checkText(url, validate) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}.`);
  }
  validate(await response.text());
  console.log(`OK ${response.status} ${url}`);
}
