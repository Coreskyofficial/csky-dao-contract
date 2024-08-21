const fs = require('fs');

function getJson(filePath) {
  const json = JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }))
  if (typeof json !== 'object') throw new Error('Invalid JSON')
  return json
}

function updateJson(jsonData, filePath) {
  let data = JSON.stringify(jsonData)
  fs.writeFileSync(filePath, data)
}

module.exports = {
  getJson,
  updateJson
}
