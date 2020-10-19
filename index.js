var express = require('express')
  , bodyParser = require('body-parser')
  , helmet = require('helmet')

const pino = require('pino-http')()
const app = express();
var path = require('path');

app.use(helmet());
app.use(pino);
app.use(bodyParser.json());
app.use(express.static('website/public'))

const port = process.env.PORT || 8000;
const { Merchant } = require('steplix-emv-qrcps');
const { Constants } = Merchant;

var cors = require('cors')

var allowlist = ['http://localhost', 'https://gerador-pix.herokuapp.com']
var corsOptionsDelegate = function (req, callback) {
  var corsOptions;
  if (allowlist.indexOf(req.header('Origin')) !== -1) {
    corsOptions = { origin: true } // reflect (enable) the requested origin in the CORS response
  } else {
    corsOptions = { origin: false } // disable CORS for this request
  }
  callback(null, corsOptions) // callback expects two parameters: error and options
}

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/website/public/index.html'));
});

app.post('/emvqr-static', cors(corsOptionsDelegate), (req, res) => {
  var { key, amount, name, reference, key_type } = req.body

  if (key) {
      var formated_key_value = formated_key(key, key_type);
      var formated_amount_value = formated_amount(amount)
      res.json({ code: generate_qrcp(formated_key_value, formated_amount_value, name, reference), key_type: key_type, key: key, amount: amount, formated_amount: formated_amount_value })
  }
  else {
    res.status(422);
    res.json({ error: "Campo Key não presente"});
  }
});

app.listen(port, () => {
  console.log(`Starting generate pix server on port ${port}!`)
});


formated_key = (key, key_type) => {
  var rkey = key.toUpperCase()

  if (key_type == 'Email') {
    rkey =  rkey.replace("@", " ");
  }

  if (key_type == 'Telefone' || key_type == 'CNPJ' || key_type == "CPF") {
    rkey = rkey.replace(/\D/g,'');
  }

  if (key_type == "Telefone") {
    rkey = "+55" + rkey
  }
  return rkey
}

formated_amount = (amount) => {
  return amount.replace(',','.').replace(' ','').replace("R$", '')
}
generate_qrcp = (key, amount, name, reference) => {
  emvqr = Merchant.buildEMVQR();

  emvqr.setPayloadFormatIndicator("01");
  emvqr.setCountryCode("BR")
  emvqr.setMerchantCategoryCode("0000");
  emvqr.setTransactionCurrency("986");
  const merchantAccountInformation = Merchant.buildMerchantAccountInformation();
  merchantAccountInformation.setGloballyUniqueIdentifier("BR.GOV.BCB.PIX");

  const paymentSystemSpecific = Merchant.buildPaymentSystemSpecific();
  paymentSystemSpecific.setGloballyUniqueIdentifier("BR.GOV.BCB.BRCODE");
  paymentSystemSpecific.addPaymentSystemSpecific("01", "1.0.0");

  merchantAccountInformation.addPaymentNetworkSpecific("01", key);

  emvqr.addMerchantAccountInformation("26", merchantAccountInformation);

  if (name) {
    emvqr.setMerchantName(name.toUpperCase());
  }

  if (amount && amount != '') {
    emvqr.setTransactionAmount(amount);
  }

  const additionalDataFieldTemplate = Merchant.buildAdditionalDataFieldTemplate();

  if (reference) {
    additionalDataFieldTemplate.setReferenceLabel(reference);
  }

  additionalDataFieldTemplate.addPaymentSystemSpecific("50", paymentSystemSpecific);
  emvqr.setAdditionalDataFieldTemplate(additionalDataFieldTemplate);
  return emvqr.generatePayload();
}