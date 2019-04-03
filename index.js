const CoinMarketCap = require('coinmarketcap-api')
const fs = require('fs')
const client = new CoinMarketCap(apiKey)
var request = require('request')

var mainfile = "/var/www/html/rates/index.html"
var supply = "/var/www/html/rates/supply"
var marketcap = "/var/www/html/rates/marketcap"
var currPrice = "/var/www/html/rates/price"
var currPriceNoRound = "/var/www/html/rates/pricenoround"
var priceChangeLoc = "/var/www/html/rates/pricechange"


// var mainfile = "index.html"
// var supply = "supply"
// var marketcap = "marketcap"
// var currPrice = "price"
// var currPriceNoRound = "pricenoround"
// var priceChangeLoc = "pricechange"

const apiKey = 'CMC API KEY'

var usdUrl = "http://www.floatrates.com/daily/usd.json"

function curlData(urlRequest, params){
  return new Promise(function(resolve){
    request.post(urlRequest, {
      json: params
    }, (error, res, body) => {
      var result = {}
      if (error) {
        result.error = true
        result.result = error
      } else {
        result.error = false
        result.result = body
      }
      resolve(result)
    })
  })
}

function getUSD(cb){
  var promisesToMake = [curlData(usdUrl)]
  var result = Promise.all(promisesToMake);
  result.then(function(result){
    cb(result[0])
  })
}

function formatNumber(num) {
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

setInterval(() => {
  client.getTickers({start: 1, limit: 1000})
  .then(function(value) {
    //fs.writeFileSync("data.txt", JSON.stringify(value, null, 2))
    if(value.status.error_code == 0)
    {
      var indexXSG = value.data.findIndex(function(e){return e.symbol == 'XSG'})
      var indexBTC = value.data.findIndex(function(e){return e.symbol == 'BTC'})
      //Circulating supply
      fs.writeFileSync(supply, formatNumber(parseFloat(value.data[indexXSG].circulating_supply.toFixed(2))))

      //Market cap
      fs.writeFileSync(marketcap, formatNumber(parseFloat((value.data[indexXSG].circulating_supply * value.data[indexXSG].quote.USD.price).toFixed(2))))

      //Price
      console.log(value.data[indexXSG])

      getUSD(function cb(data){
        // data = JSON.parse(JSON.stringify(data).replace('\"', '"'))
        // fs.writeFileSync("data.txt", JSON.stringify(data, null, 2))
        // var usdeur = data.result.eur.rate
        // var usdrub = data.result.rub.rate
        // var usdgbp = data.result.gbp.rate
        data = JSON.parse(data.result)
        var usdeur = data.eur.rate
        var usdrub = data.rub.rate
        var usdgbp = data.gbp.rate
        
        var result = []
        var btcJson = {}
        btcJson.code = "BTC"
        btcJson.symbol = "฿"
        btcJson.name = "Bitcoin"
        btcJson.rate = parseFloat((value.data[indexXSG].quote.USD.price / value.data[indexBTC].quote.USD.price).toFixed(8))

        var usdJson = {}
        usdJson.code = "USD"
        usdJson.symbol = "$"
        usdJson.name = "US Dollar"
        usdJson.rate = parseFloat(value.data[indexXSG].quote.USD.price.toFixed(3))
        usdJson.pricechange = value.data[indexXSG].quote.USD.percent_change_1h

        var eurJson = {}
        eurJson.code = "EUR"
        eurJson.symbol = "€"
        eurJson.name = "Euro"
        eurJson.rate = parseFloat((value.data[indexXSG].quote.USD.price * usdeur).toFixed(3))

        var rubJson = {}
        rubJson.code = "RUB"
        rubJson.symbol = "₽"
        rubJson.name = "Russian Rouble"
        rubJson.rate = parseFloat((value.data[indexXSG].quote.USD.price * usdrub).toFixed(3))

        var gbpJson = {}
        gbpJson.code = "GBP"
        gbpJson.symbol = "£"
        gbpJson.name = "U.K. Pound Sterling"
        gbpJson.rate = parseFloat((value.data[indexXSG].quote.USD.price * usdgbp).toFixed(3))

        result.push(btcJson)
        result.push(usdJson)
        result.push(eurJson)
        result.push(rubJson)
        result.push(gbpJson)

        fs.writeFileSync(mainfile, JSON.stringify(result))
      })
    }
  })
  .catch(console.error)
}, 20000);
