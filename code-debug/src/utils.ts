import { MIInfo, MINode } from "./backend/mi_parse";
import { FunctionString } from "./mibase";

export class ObjectAsFunction {
	functionArguments:string;
	functionBody:string;
	isAsync:boolean;
	constructor(argumentsString:string, functionBody:string, isAsync:boolean){
		this.functionArguments = argumentsString;
		this.functionBody = functionBody;
		this.isAsync = isAsync;
	}

}

export function toFunctionString(o:ObjectAsFunction):FunctionString{
	if(o.isAsync){
		return `async (${o.functionArguments})=>{ ${o.functionBody} }`;
	}
	else {
		return `(${o.functionArguments})=>{${o.functionBody}}`;
	}
}
//       /------------------------------------------------------------------------------------------_
//      /  This is bruteforce and ugly but the MINode is already a huge mess so I have to do this   /
//     /-------------------------------------------------------------------------------------------/
//   😅
export function getAddrFromMINode(info: MINode): string | undefined {
	const dfsCheckAddr = (obj: any): string | undefined => {
		for (const key in obj) {
			const value = obj[key];
			if (Array.isArray(value)) {
				if (value.length === 2 && value[0] === "addr") {
					return value[1];
				}
			}
			if (typeof value === "object") {
				const res = dfsCheckAddr(value);
				if (res != undefined) {
					return res;
				}
			}
		}
		return undefined;
	};
	for (const output of info.outOfBandRecord) {
		const res = dfsCheckAddr(output);
		if (res != undefined) {
			return res;
		}
	}

	return dfsCheckAddr(info.resultRecords.results);
}

export function getPathFromMINode(info: MINode): string {
	const dfsCheckAddr = (obj: any): string | undefined => {
		for (const key in obj) {
			const value = obj[key];
			if (Array.isArray(value)) {
				if (value.length === 2 && value[0] === "fullname") {
					return value[1];
				}
			}
			if (typeof value === "object") {
				const res = dfsCheckAddr(value);
				if (res != undefined) {
					return res;
				}
			}
		}
		return undefined;
	};
	for (const output of info.outOfBandRecord) {
		const res = dfsCheckAddr(output);
		if (res != undefined) {
			return res;
		}
	}
	return dfsCheckAddr(info.resultRecords.results);
}



export const prettyPrintJSON = (obj:any) => JSON.stringify( obj, (key, val) => (val instanceof Array) ? JSON.stringify(val) : val, 2).replace(/\\/g, '').replace(/\[/g, '[').replace(/\]/g, ']').replace(/\{/g, '{').replace(/\}/g, '}');



