# think_validtion
Validtion Util for Koatty and ThinkORM. Based on class-validator, extended parameter type checking and restricted attribute functions.


# User Decorators

* @IsDefined
* @IsCnName
* @IsIdNumber
* @IsZipCode
* @IsMobile
* @IsPlateNumber
* @IsEmail
* @IsIP
* @IsPhoneNumber
* @IsUrl
* @IsHash
* @IsNotEmpty
* @Equals
* @NotEquals
* @Contains
* @IsIn
* @IsNotIn
* @IsDate
* @Min
* @Max
* @Length

# Validator for manual

## FunctionValidator

* FunctionValidator.IsCnName
* FunctionValidator.IsIdNumber
* FunctionValidator.IsZipCode
* FunctionValidator.IsMobile
* FunctionValidator.IsPlateNumber
* FunctionValidator.IsEmail
* FunctionValidator.IsIP
* FunctionValidator.IsPhoneNumber
* FunctionValidator.IsUrl
* FunctionValidator.IsHash
* FunctionValidator.IsNotEmpty
* FunctionValidator.Equals
* FunctionValidator.NotEquals
* FunctionValidator.Contains
* FunctionValidator.IsIn
* FunctionValidator.IsNotIn
* FunctionValidator.IsDate
* FunctionValidator.Min
* FunctionValidator.Max
* FunctionValidator.Length

```js
if (!FunctionValidator.IsNotEmpty(data)) {
    console.log('error');
}
```

## ClassValidator

```js
class SchemaClass {
    @IsDefined
    id: number;
    
    @IsNotEmpty
    name: string;
}


ClassValidator.valid(SchemaClass, {name: ''}).catch(err => {
    console.log(err);
})
```

