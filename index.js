const fs = require('fs')
var request = require('request')
const phantom = require('phantom');
const rp = require('request-promise');
var isRunning = false
var currTime = 0
var lastTime = 0

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

var cmcApi = "2126f860-ba74-4e1e-b9f9-667ae60a2e34";
var usdUrl = "http://www.floatrates.com/daily/usd.json"

var coinist = [ "BTC", "ETH", "XSG", "BCH", "ZEC", "DASH", "ZEN" ]

function curlData(urlRequest, params){
  return new Promise(function(resolve){
    request.post(urlRequest, {
      json: params
    }, function(error, res, body){
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
  }, function(err) {
    cb(null)
  })
}

function formatNumber(num) {
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

function getWebsiteContentOld(coin, name, url, id, classname){
  return new Promise(async function(resolve){
    var driver = await phantom.create();
    var rtnData = {}
    try
    {
      var page = await driver.createPage();
      page.on('onConsoleMessage', function (msg) {
        // console.log('phantomjs page console message', msg);
      });
      page.on('onError', function (msg)  {
        // console.log('phantomjs page console message', msg);
      });

      page.property("viewportSize", {width: 1920, height: 1080}).then(function(){

      })

      page.on('onResourceRequested', function(requestData) {
        // console.info('Requesting', requestData.url);
      })

      // page.property('onCallback', (data) => {
      //   console.log(data)
      //   if (data.type === "loadFinished") {
      //       // do some testing
      //   }
      // })
      await page.open(url)
      var data = id ? 
        await page.evaluate(function(s) {
          return document.getElementsById(s)[0].innerText
        }, id ? id : classname)
        :
        await page.evaluate(function(s) {
          return document.getElementsByClassName(s)[0].innerText;
        }, id ? id : classname)

      data = standardData(data)
      rtnData.coin = coin
      rtnData.data = parseData(data.split(/\n/))
      rtnData.name = name
      // console.log(rtnData)
      await driver.exit()
      resolve(rtnData)

      function standardData(data){
        data = data.replace(/ \t|\t |\t/g, '|')
        data = data.replace(/ \n/g, ' ')
        return data
      }
    }
    catch(ex)
    {
      fs.appendFileSync('reject.log', ex.toString() + '\n')
      await driver.exit()
      resolve(rtnData)
    }
  })
}

function parseData(data){
  var rtn = {}
  try
  {
    var index = data.findIndex(function(e){return e.toLowerCase().includes('price')})
    rtn.price = parseFloat(data[index].split('|')[1])
    index = data.findIndex(function(e){return e.toLowerCase().includes('market cap')})
    rtn.marketcap = parseFloat(data[index].split('|')[1])
    index = data.findIndex(function(e){return e.toLowerCase().includes('24 hour volume')})
    rtn.volume24h = parseFloat(data[index].split('|')[1])
    index = data.findIndex(function(e){return e.toLowerCase().includes('circulating supply')})
    rtn.circulating = parseFloat(data[index].split('|')[1])
    index = data.findIndex(function(e){return e.toLowerCase().includes("coin change")})
    rtn.change = parseFloat(data[index].split('|')[1])
  }
  catch(ex){}
  return rtn
}

function getPrice(cb){
  const requestOptions = {
    method: 'GET',
    uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest',
    qs: {
      'start': '1',
      'limit': '2000',
      'convert': 'BTC'
    },
    headers: {
      'X-CMC_PRO_API_KEY': cmcApi
    },
    json: true,
    gzip: true
  };

  rp(requestOptions).then(response => {
    fs.writeFileSync("response.txt", JSON.stringify(response));
    cb(response);
  }).catch((err) => {
    cb(null);
  });
}
function createData(){
  lastTime = Math.floor(Date.now() / 1000)
  console.log("getting data")

  getUSD(function cb(data){
    try
    {
      data = JSON.parse(data.result)
      var usd = 1
      var usdeur = 1 / data.eur.rate
      var usdrub = 1 / data.rub.rate
      var usdgbp = 1 / data.gbp.rate

      var finalResult = []

      var usdJson = {}
      usdJson.code = "USD"
      usdJson.symbol = "$"
      usdJson.name = "US Dollar"
      usdJson.rate = parseFloat(usd.toFixed(3))
      usdJson.price = parseFloat(usd.toFixed(3))
      finalResult.push(usdJson)

      var eurJson = {}
      eurJson.code = "EUR"
      eurJson.symbol = "€"
      eurJson.name = "Euro"
      eurJson.rate = parseFloat(data.eur.rate.toFixed(3))
      eurJson.price = parseFloat(usdeur.toFixed(3))
      finalResult.push(eurJson)

      var rubJson = {}
      rubJson.code = "RUB"
      rubJson.symbol = "₽"
      rubJson.name = "Russian Rouble"
      rubJson.rate = parseFloat(data.rub.rate.toFixed(3))
      rubJson.price = parseFloat(usdrub.toFixed(3))
      finalResult.push(rubJson)

      var gbpJson = {}
      gbpJson.code = "GBP"
      gbpJson.symbol = "£"
      gbpJson.name = "U.K. Pound Sterling"
      gbpJson.rate = parseFloat(data.gbp.rate.toFixed(3))
      gbpJson.price = parseFloat((usdgbp).toFixed(3))
      finalResult.push(gbpJson)

      getData('https://coinmarketcap.com/all/views/all/')
      function getData(url){
        var promisesToMake = [
          getWebsiteContent2(url)
        ]
        var result = Promise.all(promisesToMake);
        result
        .then(function(result){
          if(result && result.length > 0)
          {
            result = result[0]
            var btcPrice
            var ethPrice
            coinist.forEach(element => {
              index = result.findIndex(function(e){return e.symbol == element})
              if(index > -1)
              {
                console.log(result[index])
                if(element == "BTC")
                {
                  var btcJson = {}
                  btcJson.code = "BTC"
                  btcJson.symbol = "฿"
                  btcJson.name = "Bitcoin"
                  btcJson.rate = 1
                  btcJson.price = btcPrice = result[index].price
                  btcJson.pricechange = formatNumber(parseFloat(result[index].change24h).toFixed(2))
                  btcJson.marketcap = result[index].marketcap
                  btcJson.volume24h = result[index].volume24h
                  btcJson.circulating = result[index].circulating
                  finalResult.push(btcJson)
                }
                else if(element == "ETH")
                {
                  var btcJson = {}
                  btcJson.code = "ETH"
                  btcJson.symbol = "E"
                  btcJson.name = result[index].fullName
                  btcJson.price = ethPrice = result[index].price
                  btcJson.rate = ethPrice / btcPrice
                  btcJson.pricechange = formatNumber(parseFloat(result[index].change24h).toFixed(2))
                  btcJson.marketcap = result[index].marketcap
                  btcJson.volume24h = result[index].volume24h
                  btcJson.circulating = result[index].circulating
                  finalResult.push(btcJson)
                }
                else
                {
                  var coinJson = {}
                  coinJson.code = element
                  coinJson.name = result[index].fullName
                  coinJson.rate = btcPrice / result[index].price
                  coinJson.rateETH = ethPrice / result[index].price
                  coinJson.price = result[index].price
                  coinJson.pricechange = formatNumber(parseFloat(result[index].change24h).toFixed(2))
                  coinJson.marketcap = result[index].marketcap
                  coinJson.volume24h = result[index].volume24h
                  coinJson.circulating = result[index].circulating
                  finalResult.push(coinJson)

                  if(element == 'XSG')
                  {
                    fs.writeFileSync(currPrice, formatNumber(parseFloat(coinJson.price).toFixed(3)))
                    fs.writeFileSync(currPriceNoRound, formatNumber(parseFloat(coinJson.price)))
                    fs.writeFileSync(supply, formatNumber(parseFloat(coinJson.circulating).toFixed(2)))

                    //Market cap
                    fs.writeFileSync(marketcap, formatNumber(parseFloat((coinJson.circulating * coinJson.price).toFixed(2))))
                  }
                }
              }
              else
              {
                console.log("Cannot find " + element + " data")
              }
            });
            fs.writeFileSync(mainfile, JSON.stringify(finalResult))
            console.log("finished, sleep 60 secs")
            setTimeout(function(){
              createData()
            }, 60000);
          }
          else {
            console.log("finished, sleep 60 secs")
            setTimeout(function(){
              createData()
            }, 60000);
          }
        })
      }
    }
    catch(ex){
      console.log("exception, sleep 60 secs")
      setTimeout(function() {
        createData()
      }, 60000);
    }

  })
}

createData()

function getWebsiteContent2(url){
  return new Promise(async function(resolve){
    var rtnData = []
    getData()
    function getData(){
      request(url, function (error, response, body) {
        // console.error('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        // console.log('body:', body); // Print the HTML for the Google homepage.
        if(response && response.statusCode == 200) {
          try {
            var tbody = body.split("<tbody>")[1].split("</tbody>")[0]
            var split = tbody.split("<tr")
            split.splice(0, 1)
            split.forEach(element => {
              var split = element.split("<td")
              var data = {}
              data.fullName = split[2].split('">')[0].split('data-sort="')[1]
              data.symbol = split[3].split('col-symbol">')[1].split('</td>')[0]
              data.marketcap = split[4].split('data-usd="')[1].split('"')[0]
              data.price = split[5].split('data-sort="')[1].split('"')[0]
              data.circulating = split[6].split('data-sort="')[1].split('"')[0]
              data.volume24h = split[7].split('data-sort="')[1].split('"')[0]
              data.change1h = split[8].split('data-sort="')[1].split('"')[0]
              data.change24h = split[9].split('data-sort="')[1].split('"')[0]
              data.change7d = split[10].split('data-sort="')[1].split('"')[0]
              rtnData.push(data)
            });
            resolve(rtnData)
          }
          catch(ex){
            getData()
          }
        }
        else {
          getData()
        }
      })
    }
  })
}

function getWebsiteContent(coin, name, url){
  return new Promise(async function(resolve){
    var rtnData = {}
    getData()
    function getData(){
      request(url, function (error, response, body) {
        // console.error('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        // console.log('body:', body); // Print the HTML for the Google homepage.
        if(response && response.statusCode == 200) {
          try {
            var pricechange = body.split("details-panel-item--price")[2].split("toolbar-buttons")[0]
            pricechange = pricechange.split("toolbar-buttons")[0]
            pricechange = pricechange.split("data-format-percentage")[1].split("</span>")[0].split(">")[1]
            var split = body.split("cmc-cc-summary-table")[1]
            split = split.split("/table")[0]
            split = split.split("<th scope=\"row\">\n")
            var temp = []
            split.forEach(e => {
              if(e.toLowerCase().includes('price') || e.toLowerCase().includes('market cap') || e.toLowerCase().includes('24 hour volume') ||
              e.toLowerCase().includes('circulating supply'))
              {
                temp.push(e)
              }
            });
            for(var i = 0; i < temp.length; i++) {
              var splt = temp[i].split("\n</th>")
              var data = splt[1].split("<td>")[1].split("</td>")[0].split("</span>")[0].split(">")
              temp[i] = splt[0] + "|" + data[data.length - 1].replace(/,|\n|/g, '')
            }
            temp.push("Coin change|" + pricechange)
            rtnData.coin = coin
            rtnData.data = parseData(temp)
            rtnData.name = name
            resolve(rtnData)
          }
          catch(ex){
            getData()
          }
        }
        else {
          getData()
        }
      })
    }
  })
}

getPrice();
// setInterval(function() {
//   currTime = Math.floor(Date.now() / 1000)
//   if(currTime - lastTime > 5 * 60 * 1000)
//   {
//     createData()
//   }
// }, 1000);

// getWebsiteContent2('https://coinmarketcap.com/all/views/all/', function(data){
//   fs.writeFileSync("data.txt", data[0])
// })