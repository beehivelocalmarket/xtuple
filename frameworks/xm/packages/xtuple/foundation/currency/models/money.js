// ==========================================================================
// Project:   xTuple Postbooks - Business Management System Framework
// Copyright: ©2011 OpenMFG LLC, d/b/a xTuple
// ==========================================================================
/*globals XM */
sc_require('models/currency');
sc_require('models/currency_rate');
/** @class

  This class handles conversions between a local currency and the system base
  currency. The currency, effective date and local values are set on the object,
  or more likely bound to other objects, and then the converted baseValue can be 
  inquired on or bound to.
  

  @extends XT.Object
*/

XM.Money = XT.Object.extend(
/** @scope XM.Money.prototype */ {

  /**
    Precision used for rounding. Appropriate scales would be:
      * XT.MONEY_SCALE
      * XT.COST_SCALE
      * XT.SALES_PRICE_SCALE
      * XT.PURCHASE_PRICE_SCALE
      * XT.EXTENDED_PRICE SCALE
    
    @seealso XT.core
    @type Number
    @default XT.MONEY_SCALE
  */
  precision: XT.MONEY_SCALE,
 
  /**
    The monetary value to be converted.
    
    @type Number
    @default 0
  */
  localValue: 0,

  /**
    Calculated from the currency and effective date unless
    set manually unless `isFixed` is true.
    
    @seealso isFixed
    @type Number
    @default 1
  */
  exchangeRate: 1,
  
  /**
    Set to true to prevent the exchange rate from being recalculated.
    This applies to documents where the exchange rate is fixed once it
    is posted and any references to it never change, even if the exchange 
    rate table is edited.
    
    @seealso exchangeRate
    @type Boolean
    @default false
  */
  isFixed: false,
  
  /**
    Store to run queries against.
    
    @type {SC.Store}
    @default XT.store
  */
  store: null,
  
  /**
    Indicates the object is querying an exchange rate from the datasource.
  */
  isLoading: false,
  
  // .................................................
  // CALCULATED PROPERTIES
  //
  
  init: function() {
    arguments.callee.base.apply(this, arguments);
    if (!this.get('store')) this.set('store', XT.store);
  },
  
  /**
    The local value converted to base currency.
    
    @type Number
    @default 0
  */  
  baseValue: function() {
    // if we're in base currency just return local value
    var currency = this.get('currency'),
        localValue = this.get('localValue');
    if (currency === XM.Currency.BASE) return localValue;
    
    // calculate
    var exchangeRate = this.get('exchangeRate'),
        precision = this.get('precision');
    return exchangeRate ? (localValue / exchangeRate).round(precision) : '?????';
    
    var effective = this.get('effective');
  }.property('localValue', 'exchangeRate', 'precision').cacheable(),
  
  /**
    The currency of the local value.
    
    @type XM.Currency
    @default base currency
  */
  currency: function(key, value) {
    if (value !== undefined) this._xm_currency = value;
    
    // return base currency if not otherwise defined
    if (!this._xm_currency) {
      var store = this.get('store');
      this._xm_currency = store.find(XM.Currency, XM.Currency.BASE);
    }
    return this._xm_currency
  }.property(),
  
  /**
    Effective date used to determine exchange rate.
    
    @type XT.DateTime
    @default currentDate
  */
  effective: function(key, value) {
    if (value !== undefined) {
      this._xm_effective = value;
    } else if (!this._xm_effective) {
      this._xm_effective = XT.DateTime.create();
    }
    return this._xm_effective;
  }.property(),
  
  /**
    Convienience function that indicates the local currency.
    
    @type Boolean
  */
  isBase: function() {
    return this.getPath('currency.id') === XM.Currency.BASE;
  }.property('currency').cacheable(),
  
  //..................................................
  // OBSERVERS
  //
  
  /**
    Recalculates the exchange rate.
  */
  exchangeRateCriteriaDidChange: function() {  
    // if posted or loading, bail out
    if (this.get('isFixed') || this.get('isLoading')) return;
    
    var currency = this.get('currency'),
        effective = this.get('effective');
      
    // if we've already processed this, bail out
    if (currency === this._xm_currencyCache &&
        effective === this._xm_effectiveCache) return;

    // if the currency is base, always set to one 1
    if (currency.get('id') === XM.Currency.BASE) {
      this.setIfChanged('exchangeRate', 1);
    }

    // build the query
    qry = SC.Query.local(XM.CurrencyRate, {
      conditions: "currency = {currency} "
                + "AND effective <= {effective} "
                + "AND expires >= {effective} ",
      parameters: {  
        currency: currency,
        effective: effective 
      }
    });
      
    this.set('isLoading', true);
      
    // fetch the value
    var that = this,
        store = this.get('store'),
        ary = store.find(qry);
      
    // set the exchange rate once we have it
    ary.addObserver('status', ary, function observer() {
      if (ary.get('status') === SC.Record.READY_CLEAN) {
        ary.removeObserver('status', ary, observer);
        that.setIfChanged('exchangeRate', ary.firstObject() ? ary.firstObject().get('rate') : 0);
        that.set('isLoading', false);
      }
    })
    
    // remember what we did so we don't run again unless we need to
    this._xm_currencyCache = currency;
    this._xm_effectiveCache = effective;
  }.observes('currency', 'effective', 'isFixed', 'isLoading').cacheable(),
  
}) ;


