/** Canonical wire shapes are owned by src/backend/schemas.py.
 * @typedef {{role:'staff'|'supervisor'|'supplier',tenant:string}} DemoContext
 * @typedef {{product_name:string|null,brand:string|null,manufacturer:string|null,halal_mark_present:boolean|null}} LabelExtraction
 * @typedef {{product_name:string,brand?:string|null}} ScopeItem
 * @typedef {{id:number,name:string,supplier_id:number,supplier_name:string,approved_brand:string,approved_manufacturer:string,coverage_status:'covered'|'expiring'|'not_covered',certificate_expiry_date:string|null}} Material
 * @typedef {{rule:'R1'|'R2'|'R3'|'R4'|'R5',passed:boolean|null,detail:string}} RuleResult
 * @typedef {{id:number,material_id:number,image:string,extracted:LabelExtraction|null,rule_results:RuleResult[],verdict:string,status:string,error:string|null,decided_by:string|null,reason:string|null,created_at:string}} Delivery
 */
export {};
