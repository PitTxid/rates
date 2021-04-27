const fs = require('fs')
var request = require('request')
const phantom = require('phantom');
const rp = require('request-promise');
var isRunning = false
var currTime = 0
var lastTime = 0

var mainfile = "/var/www/html/rates/rates/index.html"
var supply = "/var/www/html/rates/rates/supply"
var marketcap = "/var/www/html/rates/rates/marketcap"
var currPrice = "/var/www/html/rates/rates/price"
var currPriceNoRound = "/var/www/html/rates/rates/pricenoround"
var priceChangeLoc = "/var/www/html/rates/pricechange"


// var mainfile = "index.html"
// var supply = "supply"
// var marketcap = "marketcap"
// var currPrice = "price"
// var currPriceNoRound = "pricenoround"
// var priceChangeLoc = "pricechange"

var indexApi = 0;
var cmcApis = ["8b2d5f10-bd92-4378-ad7c-cd143651e185", "3fa2b0bb-19e7-4376-8ec1-55ef62e9b91a", "b69a6dde-262e-401e-855e-46e2be8871db", "be37fcab-017b-4681-be2f-05d7b4ec5f0f",
  "835736bb-cf97-4d6e-a5a6-f08273a15c63", "2126f860-ba74-4e1e-b9f9-667ae60a2e34", "e8cf920e-4d15-4217-8540-20326fed7bdf", "e8cf920e-4d15-4217-8540-20326fed7bdf",
  "95a3018d-6596-4f4c-9079-692d4b3a2050", "7baabb0a-0486-453f-80e4-11303a5b929d", "7baabb0a-0486-453f-80e4-11303a5b929d", "58dd3ed3-b9e6-490b-8135-eb29f910c771",
  "5ce649a3-60c9-4315-87fd-8579eaa8774d", "33591ab9-798c-4613-bd14-d7fe9b5f324e", "33591ab9-798c-4613-bd14-d7fe9b5f324e", "33591ab9-798c-4613-bd14-d7fe9b5f324e",
  "0a46a02e-e607-4e70-8a69-045d33329814", "923db9a7-8eba-4c16-80c2-82e44dfe0f07", "d5f32400-c1c7-4846-98d4-322d4eb139ef", "163eca81-5572-4679-ba57-94bdb142f6ea"]; //t17-20
var usdUrl = "http://www.floatrates.com/daily/usd.json"
var sumUrl = "https://sumcoinindex.com/rates/price2.json"

var coinist = ["BTC", "ETH", "TENT", "BCH", "ZEC", "DASH", "ZEN", "BITG", "DGB", "ZEL", "USDT", "BUSD", "LTC", "BTCZ", "SUM", "ZER", "PIRL", "VDL", "DOGE"]

function getCoinList() {
  return JSON.parse(fs.readFileSync("coinlist.json"));
}
function curlData(urlRequest, params) {
  return new Promise(function (resolve) {
    request.post(urlRequest, {
      json: params
    }, function (error, res, body) {
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

function getData(urlRequest) {
  return new Promise(function (resolve) {
    request.get(urlRequest, function (error, res, body) {
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

function getSum(cb) {
  var promisesToMake = [getData(sumUrl)]
  var result = Promise.all(promisesToMake);
  result.then(function (result) {
    cb(result[0])
  }, function (err) {
    cb(null)
  })
}
function getUSD(cb) {
  var promisesToMake = [curlData(usdUrl)]
  var result = Promise.all(promisesToMake);
  result.then(function (result) {
    cb(result[0])
  }, function (err) {
    cb(null)
  })
}

function formatNumber(num) {
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

function getWebsiteContentOld(coin, name, url, id, classname) {
  return new Promise(async function (resolve) {
    var driver = await phantom.create();
    var rtnData = {}
    try {
      var page = await driver.createPage();
      page.on('onConsoleMessage', function (msg) {
        // console.log('phantomjs page console message', msg);
      });
      page.on('onError', function (msg) {
        // console.log('phantomjs page console message', msg);
      });

      page.property("viewportSize", {
        width: 1920,
        height: 1080
      }).then(function () {

      })

      page.on('onResourceRequested', function (requestData) {
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
        await page.evaluate(function (s) {
          return document.getElementsById(s)[0].innerText
        }, id ? id : classname) :
        await page.evaluate(function (s) {
          return document.getElementsByClassName(s)[0].innerText;
        }, id ? id : classname)

      data = standardData(data)
      rtnData.coin = coin
      rtnData.data = parseData(data.split(/\n/))
      rtnData.name = name
      // console.log(rtnData)
      await driver.exit()
      resolve(rtnData)

      function standardData(data) {
        data = data.replace(/ \t|\t |\t/g, '|')
        data = data.replace(/ \n/g, ' ')
        return data
      }
    } catch (ex) {
      fs.appendFileSync('reject.log', ex.toString() + '\n')
      await driver.exit()
      resolve(rtnData)
    }
  })
}

function parseData(data) {
  var rtn = {}
  try {
    var index = data.findIndex(function (e) {
      return e.toLowerCase().includes('price')
    })
    rtn.price = parseFloat(data[index].split('|')[1])
    index = data.findIndex(function (e) {
      return e.toLowerCase().includes('market cap')
    })
    rtn.marketcap = parseFloat(data[index].split('|')[1])
    index = data.findIndex(function (e) {
      return e.toLowerCase().includes('24 hour volume')
    })
    rtn.volume24h = parseFloat(data[index].split('|')[1])
    index = data.findIndex(function (e) {
      return e.toLowerCase().includes('circulating supply')
    })
    rtn.circulating = parseFloat(data[index].split('|')[1])
    index = data.findIndex(function (e) {
      return e.toLowerCase().includes("coin change")
    })
    rtn.change = parseFloat(data[index].split('|')[1])
  } catch (ex) { }
  return rtn
}

function getPrice() {
  return new Promise(async function (resolve) {
    function get(cb) {
      const requestOptions = {
        method: 'GET',
        uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest',
        qs: {
          'start': '1',
          'limit': '2000',
          'convert': 'USD'
        },
        headers: {
          'X-CMC_PRO_API_KEY': cmcApis[indexApi]
        },
        json: true,
        gzip: true
      };

      rp(requestOptions).then(response => {
        if (response.status.error_code == 1009) {
          indexApi += 1;
          setTimeout(function () {
            get(cb);
          }, 10 * 1000);
        }
        else {
          cb(response);
        }
      }).catch((err) => {
        if (err.error && err.error.status) {
          console.log(err.error.status.error_message);
        }
        if (err.error && err.error.status && (err.error.status.error_code == 1009 || err.error.status.error_code == 1010)) {
          indexApi += 1;
          setTimeout(function () {
            get(cb);
          }, 10 * 1000);
        }
        else {
          cb(undefined);
        }
      });
    }

    get(function (result) {
      resolve(result);
    })
  })
}

function createData() {
  lastTime = Math.floor(Date.now() / 1000)
  console.log("getting data")

  getUSD(function (data) {
    try {
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

      getPrice().then(result => {

        if (result && result.status.error_code == 0) {
          var btcPrice
          var ethPrice
          var cc = getCoinList();
          coinist = [...coinist, ...cc];
          coinist = coinist.filter(function (elem, index, self) {
            return index === self.indexOf(elem);
          })
          coinist.forEach(element => {
            index = result.data.findIndex(function (e) {
              return e.symbol == element
            })
            if (index > -1) {
              console.log(result.data[index])
              if (element == "BTC") {
                var btcJson = {}
                btcJson.code = "BTC"
                btcJson.symbol = "฿"
                btcJson.name = "Bitcoin"
                btcJson.rate = 1
                btcJson.price = btcPrice = result.data[index].quote.USD.price
                btcJson.pricechange = formatNumber(parseFloat(result.data[index].quote.USD.percent_change_24h).toFixed(2))
                btcJson.marketcap = result.data[index].quote.USD.market_cap
                btcJson.volume24h = result.data[index].quote.USD.volume_24h
                btcJson.circulating = result.data[index].quote.USD.circulating_supply
                finalResult.push(btcJson)
              } else if (element == "ETH") {
                var btcJson = {}
                btcJson.code = "ETH"
                btcJson.symbol = "E"
                btcJson.name = result.data[index].name
                btcJson.price = ethPrice = result.data[index].quote.USD.price
                btcJson.rate = ethPrice / btcPrice
                btcJson.pricechange = formatNumber(parseFloat(result.data[index].quote.USD.percent_change_24h).toFixed(2))
                btcJson.marketcap = result.data[index].quote.USD.market_cap
                btcJson.volume24h = result.data[index].quote.USD.volume_24h
                btcJson.circulating = result.data[index].quote.USD.circulating_supply
                finalResult.push(btcJson)
              } else {
                var coinJson = {}
                coinJson.code = element
                coinJson.name = result.data[index].quote.USD.name
                coinJson.rate = btcPrice / result.data[index].quote.USD.price
                coinJson.rateETH = ethPrice / result.data[index].quote.USD.price
                coinJson.price = result.data[index].quote.USD.price
                coinJson.pricechange = formatNumber(parseFloat(result.data[index].quote.USD.percent_change_24h).toFixed(2))
                coinJson.marketcap = result.data[index].quote.USD.market_cap
                coinJson.volume24h = result.data[index].quote.USD.volume_24h
                coinJson.circulating = result.data[index].quote.USD.circulating_supply
                finalResult.push(coinJson)

                if (element == 'XSG' || element == 'TENT') {
                  fs.writeFileSync(currPrice, formatNumber(parseFloat(coinJson.price).toFixed(3)))
                  fs.writeFileSync(currPriceNoRound, formatNumber(parseFloat(coinJson.price)))
                  fs.writeFileSync(supply, formatNumber(parseFloat(coinJson.circulating).toFixed(2)))

                  //Market cap
                  fs.writeFileSync(marketcap, formatNumber(parseFloat((coinJson.circulating * coinJson.price).toFixed(2))))
                  if (element == 'TENT') {
                    var cp = { ...coinJson };
                    cp.code = "XSG"
                    cp.name = "XSG"
                    finalResult.push(cp)
                  }
                }
              }
            } else {
              console.log("Cannot find " + element + " data")
            }
          });

          //for sum
          getSum(function (dataaa) {
            if (dataaa != null) {
              var jsSum = JSON.parse(dataaa.result);
              var coinJson = {}
              coinJson.code = 'SUM'
              coinJson.name = 'Sumcoin'
              coinJson.pricechange = 0
              finalResult.push(coinJson)

              var idx = finalResult.findIndex(e => e.code == "SUM");
              if (idx > -1) {
                // var idx2 = jsSum.findIndex(e => e.code == "USD");
                finalResult[idx].rate = btcPrice / jsSum.exch_rate;
                finalResult[idx].rateETH = ethPrice / jsSum.exch_rate
                finalResult[idx].price = jsSum.exch_rate
                finalResult[idx].marketcap = jsSum["marketcap_USD"]
                finalResult[idx].volume24h = jsSum["24hrvolume_USD"]
                finalResult[idx].circulating = Math.floor(jsSum["24hrvolume_USD"] / jsSum.exch_rate)
              }
              fs.writeFileSync(mainfile, JSON.stringify(finalResult))
              console.log("finished, sleep 240 secs")
              setTimeout(function () {
                createData()
              }, 4 * 60 * 1000);
            }
            else {
              fs.writeFileSync(mainfile, JSON.stringify(finalResult))
              console.log("finished, sleep 240 secs")
              setTimeout(function () {
                createData()
              }, 4 * 60 * 1000);
            }
          })
        }
        else {
          setTimeout(function () {
            createData()
          }, 4 * 60 * 1000);
        }
      })
    } catch (ex) {
      console.log("exception, sleep 240 secs")
      setTimeout(function () {
        createData()
      }, 4 * 60 * 1000);
    }

  })
}

createData()

function getWebsiteContent2(url) {
  return new Promise(async function (resolve) {
    var rtnData = []
    getData()

    function getData() {
      request(url, function (error, response, body) {
        // console.error('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        // console.log('body:', body); // Print the HTML for the Google homepage.
        if (response && response.statusCode == 200) {
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
          } catch (ex) {
            getData()
          }
        } else {
          getData()
        }
      })
    }
  })
}

function getWebsiteContent(coin, name, url) {
  return new Promise(async function (resolve) {
    var rtnData = {}
    getData()

    function getData() {
      request(url, function (error, response, body) {
        // console.error('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        // console.log('body:', body); // Print the HTML for the Google homepage.
        if (response && response.statusCode == 200) {
          try {
            var pricechange = body.split("details-panel-item--price")[2].split("toolbar-buttons")[0]
            pricechange = pricechange.split("toolbar-buttons")[0]
            pricechange = pricechange.split("data-format-percentage")[1].split("</span>")[0].split(">")[1]
            var split = body.split("cmc-cc-summary-table")[1]
            split = split.split("/table")[0]
            split = split.split("<th scope=\"row\">\n")
            var temp = []
            split.forEach(e => {
              if (e.toLowerCase().includes('price') || e.toLowerCase().includes('market cap') || e.toLowerCase().includes('24 hour volume') ||
                e.toLowerCase().includes('circulating supply')) {
                temp.push(e)
              }
            });
            for (var i = 0; i < temp.length; i++) {
              var splt = temp[i].split("\n</th>")
              var data = splt[1].split("<td>")[1].split("</td>")[0].split("</span>")[0].split(">")
              temp[i] = splt[0] + "|" + data[data.length - 1].replace(/,|\n|/g, '')
            }
            temp.push("Coin change|" + pricechange)
            rtnData.coin = coin
            rtnData.data = parseData(temp)
            rtnData.name = name
            resolve(rtnData)
          } catch (ex) {
            getData()
          }
        } else {
          getData()
        }
      })
    }
  })
}

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