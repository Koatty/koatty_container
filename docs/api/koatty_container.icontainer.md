<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [koatty\_container](./koatty_container.md) &gt; [IContainer](./koatty_container.icontainer.md)

## IContainer interface

Container interface

  IContainer

**Signature:**

```typescript
export interface IContainer 
```

## Methods

|  Method | Description |
|  --- | --- |
|  [attachClassMetadata(type, decoratorNameKey, data, target, propertyName)](./koatty_container.icontainer.attachclassmetadata.md) | attach data to class or property |
|  [attachPropertyData(decoratorNameKey, data, target, propertyName)](./koatty_container.icontainer.attachpropertydata.md) | attach property data to class |
|  [get(identifier, type, args)](./koatty_container.icontainer.get.md) | <p>get an instance from the IOC container.</p><p> T</p> |
|  [getApp()](./koatty_container.icontainer.getapp.md) | get app |
|  [getClass(identifier, type)](./koatty_container.icontainer.getclass.md) | get class from IOC container by identifier. |
|  [getClassMetadata(type, decoratorNameKey, target, propertyName)](./koatty_container.icontainer.getclassmetadata.md) | get single data from class or property |
|  [getIdentifier(target)](./koatty_container.icontainer.getidentifier.md) | get identifier from class |
|  [getInsByClass(target, args)](./koatty_container.icontainer.getinsbyclass.md) | <p>get instance from IOC container by class.</p><p> T</p> |
|  [getMetadataMap(metadataKey, target, propertyKey)](./koatty_container.icontainer.getmetadatamap.md) | <p>get metadata from class</p> |
|  [getPropertyData(decoratorNameKey, target, propertyName)](./koatty_container.icontainer.getpropertydata.md) | get property data from class |
|  [getType(target)](./koatty_container.icontainer.gettype.md) | get component type from class |
|  [listClass(type)](./koatty_container.icontainer.listclass.md) | get all class from Container |
|  [listPropertyData(decoratorNameKey, target)](./koatty_container.icontainer.listpropertydata.md) | list property data from class |
|  [reg(identifier, target, options)](./koatty_container.icontainer.reg.md) | <p>registering an instance of a class to an IOC container.</p><p> T</p> |
|  [saveClass(type, module, identifier)](./koatty_container.icontainer.saveclass.md) | save class to Container |
|  [saveClassMetadata(type, decoratorNameKey, data, target, propertyName)](./koatty_container.icontainer.saveclassmetadata.md) | save meta data to class or property |
|  [savePropertyData(decoratorNameKey, data, target, propertyName)](./koatty_container.icontainer.savepropertydata.md) | save property data to class |
|  [setApp(app)](./koatty_container.icontainer.setapp.md) | set app |

